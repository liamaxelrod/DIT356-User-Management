import paho.mqtt.client as mqtt
import time
import json

# The topic to publish to
topic = "dentistimo/register/dentist"

# The number of messages to send
num_messages = 1100

# Create an MQTT client
client = mqtt.Client()

# Connect to the broker
client.connect("broker.emqx.io", 1883)

# Publish the specified number of messages
for i in range(num_messages):
    client.publish(
        topic,
        json.dumps(
            {
                "firstName": "Liam",
                "lastName": "sdfgwerg",
                "password": "Password123",
                "passwordCheck": "Password123",
                "email": f"1vvalkaaaaaaa1mmhhh11a1{i}@gmail.com",
                "requestId": "123456789",
                "officeId": "3",
            }
        ),
        qos=0
    )
    time.sleep(0.001)  # Delay between messages

# Disconnect from the broker
client.disconnect()