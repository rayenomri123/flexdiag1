import argparse
import logging
import time
import sys
from datetime import datetime, timezone
from doipclient import DoIPClient
from doipclient.connectors import DoIPClientUDSConnector
from udsoncan.client import Client
from udsoncan import configs, Request
from udsoncan.services import ReadDataByIdentifier
from udsoncan.exceptions import (
    NegativeResponseException,
    InvalidResponseException,
    UnexpectedResponseException
)
from udsoncan import AsciiCodec
import json

# Initialize logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("doipclient")

# Helper to log messages with timestamps
def add_log(message, level='info'):
    log = {
        'timestamp': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
        'message': message,
        'level': level
    }
    logger.log(getattr(logging, level.upper()), message)
    return log

# Parse command-line arguments
def parse_args():
    parser = argparse.ArgumentParser(description='UDS over DoIP Client')
    parser.add_argument('-i', '--ip', type=str, required=True, help='Target IP of the car PCU')
    parser.add_argument('-l', '--la', type=str, required=True, help='ECU logical address (hex, e.g. 0x545)')
    return parser.parse_args()

# Main logic
def main():
    args = parse_args()
    ip_address = args.ip
    logical_address = int(args.la, 16)

    add_log(f"Connecting to ECU at {ip_address}, LA {hex(logical_address)}")

    # Setup DoIP client
    doip_client = None
    for attempt in range(5):
        try:
            doip_client = DoIPClient(ip_address, logical_address, tcp_port=13400, udp_port=13400,
                                     protocol_version=2, client_logical_address=0x0E00)
            add_log("Connected to UDS server")
            break
        except Exception as e:
            add_log(f"Conn attempt {attempt+1} failed: {e}", 'error')
            time.sleep(10)
    if not doip_client:
        sys.exit(1)

    conn = DoIPClientUDSConnector(doip_client)
    config = dict(configs.default_client_config)
    # Only ASCII fields configured here
    config.update({
        'data_identifiers': {
            0xF18C: AsciiCodec(16),
            0xF075: AsciiCodec(10),  # ECU Type-A variant
            0xF18A: AsciiCodec(10),  # System supplier ID
            0xF191: AsciiCodec(10),  # ECU HW number
            0xF187: AsciiCodec(10),  # Spare part number
        }
    })

    # Open UDS client
    try:
        client = Client(conn, config=config)
        client.open()
        add_log("UDS client opened")
    except Exception as e:
        add_log(f"Failed to open UDS client: {e}", 'error')
        sys.exit(1)

    # DIDs to retrieve
    dids = {
        'ecuSerialNumber':  0xF18C,
        'ecuTypeVariant': 0xF075,
        'systemSupplierIdentifier': 0xF18A,
        'vehicleManufacturerEcuHardwareNumber': 0xF191,
        'manufacturerSparePartNumber': 0xF187,
        'indexSrvData': 0xF011,
    }
    result = {}

    try:
        for key, did in dids.items():
            add_log(f"Requesting DID {hex(did)}")
            try:
                req = Request(service=ReadDataByIdentifier, data=bytes([did>>8, did&0xFF]))
                resp = client.send_request(req)
                if resp.positive:
                    payload = resp.data[2:]
                    if did != 0xF011:
                        value = payload.decode('ascii', errors='ignore').rstrip('\x00')
                    else:
                        value = str(int.from_bytes(payload, byteorder='big'))
                    result[key] = value
                    add_log(f"DID {hex(did)} = {value}")
                else:
                    raise NegativeResponseException(resp)
            except (NegativeResponseException, InvalidResponseException,
                    UnexpectedResponseException) as e:
                result[key] = f"UDS Error: {e}"
                add_log(f"Error reading DID {hex(did)}: {e}", 'error')
            except Exception as e:
                result[key] = f"Exception: {e}"
                add_log(f"Exception on DID {hex(did)}: {e}", 'error')

        # Print filtered results
        print(json.dumps({'type':'uds-vehicle-info', 'data':result}, indent=2))

    finally:
        try:
            client.close()
            add_log("UDS client closed")
        except:
            pass
        try:
            doip_client.close()
            add_log("DoIP client closed")
        except:
            pass

if __name__ == '__main__':
    main()