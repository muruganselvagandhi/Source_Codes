from opcua import Client, ua
import json
import ssl
import paho.mqtt.client as mqtt

# -------- OPC UA --------
opc = Client("opc.tcp://DRAKYPC:53530/OPCUA/SimulationServer/")
opc.connect()

node_windspeed     = opc.get_node("ns=3;i=1011")
node_winddirection = opc.get_node("ns=3;i=1012")
node_activepower   = opc.get_node("ns=3;i=1013")
node_timestamp     = opc.get_node("ns=3;s=1014")

# -------- MQTT --------
BROKER = "1bb52e5669a44705a46bedceffaee603.s1.eu.hivemq.cloud"
USER   = "WindFarm"
PASS   = "Wind1234"
TOPIC  = "windfarm/arduino"

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        print("Raw payload:", payload)

        ws = (
            payload.get("windSpeed")
            or payload.get("speed")
            or 0.0
        )
        wd = (
            payload.get("windDirection")
            or payload.get("direction")
            or 0.0
        )
        ap = (
            payload.get("activePower")
            or payload.get("power")
            or 0.0
        )
        ts = (
            payload.get("timestamp")
            or payload.get("time")
            or ""
        )

        print(f"MQTT → OPC: WS={ws}, WD={wd}, AP={ap}, TS={ts}")

        node_windspeed.set_value(ua.Variant(float(ws), ua.VariantType.Double))
        node_winddirection.set_value(ua.Variant(float(wd), ua.VariantType.Double))
        node_activepower.set_value(ua.Variant(float(ap), ua.VariantType.Double))
        node_timestamp.set_value(ua.Variant(str(ts), ua.VariantType.String))

    except Exception as e:
        print("Error in on_message:", e)

# Use new callback API to avoid warning
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

client.username_pw_set(USER, PASS)

# Explicit TLS setup using the ssl module we know works
client.tls_set(
    certfile=None,
    keyfile=None,
    cert_reqs=ssl.CERT_REQUIRED,
    tls_version=ssl.PROTOCOL_TLS_CLIENT,
    ciphers=None
)

client.on_message = on_message

client.connect(BROKER, 8883)
client.subscribe(TOPIC)
client.loop_forever()
