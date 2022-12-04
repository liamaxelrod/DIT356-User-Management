const mqtt = require('mqtt');
require('dotenv').config();
//const { auth, requiredScopes } = require('express-oauth2-jwt-bearer');

//topics
const topic = 'my/test/topic';
const topic1 = '/nodejs/albin';

//mqtt setup
const port = '8883';
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
const connectUrl = `mqtts://${process.env.MQTT_BROKER}:${port}`;
const client = mqtt.connect(connectUrl, {
    clientId,
    clean: true,
    connectTimeout: 4000,
    username: process.env.USER_ID,
    password: process.env.PASSWORD,
    reconnectPeriod: 1000,
});

// This is the basic method for verifying the access token,
// commented out to avoid eslint error because it's unused for now
// const checkJwt = auth({
//     audience: 'http://localhost/',
//     issuerBaseURL: `https://dev-basqq6ug.eu.auth0.com/`,
// });

client.on('connect', () => {
    console.log('Connected');
    client.subscribe([topic], () => {
        console.log(`Subscribe to topic '${topic}'`);
        console.log(clientId);
    });
    client.subscribe([topic1], () => {
        console.log(`Subscribe to topic '${topic1}'`);
        console.log(clientId);
    });
    client.publish(
        topic,
        'nodejs mqtt test',
        { qos: 1, retain: false },
        (error) => {
            if (error) {
                console.error(error);
            }
        }
    );
});

client.on('message', (topic, payload) => {
    console.log('Received Message:', topic, payload.toString());
    var message = payload.toString();
    if (topic == 'my/test/topic') {
        filterTopic(topic, message);
    } else if (topic1 == '/nodejs/albin') {
        console.log(message);
    } else {
        console.log('funkar ej');
    }

    function filterTopic(topic, message) {
        if (topic == 'my/test/topic') {
            messageFilter(topic, message);
        } else {
            console.log('nope');
        }
    }

    function messageFilter(topic, message) {
        if (message.includes('authorization')) {
            let Flexiple = message;
            let flexiplelist = Flexiple.split(' ');
            let hello = flexiplelist[4];
            let hello2 = hello.replace(',', '');
            console.log(hello2);
            console.log('works');
        } else if (message == 'Erik') {
            console.log(topic, 'Erik owes Albin Julmuuuuust!');
        }
    }
});

console.log('running...');
