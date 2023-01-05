require('dotenv').config();
const mqtt = require('mqtt');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const opossum = require('opossum');

const { registerUser } = require('./register');
const { login } = require('./login');
const { modifyUser } = require('./modifyUser');
const { resetPassword } = require('./resetPassword');
const { sendEmailCode } = require('./resetPassword');
const { handleVerifyIdTokenRequest } = require('./helpers/verifyJWT');

// Register topics
const registerUserTopic = 'dentistimo/register/user';
const registerDentistTopic = 'dentistimo/register/dentist';

// Login topics
const loginUserTopic = 'dentistimo/login/user';
const loginDentistTopic = 'dentistimo/login/dentist';

// Modify and reset password topics
const modifyUserTopic = 'dentistimo/modify-user';
const resetPasswordDentistTopic = 'dentistimo/reset-password/dentist';
const resetPasswordUserTopic = 'dentistimo/reset-password/user';
const sendEmailCodeTopic = 'dentistimo/send-email-code';

const authenticationTopic = 'dentistimo/authentication';

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_ADDRESS,
        pass: process.env.EMAIL_PASSWORD,
    },
});

// Mongo setup
const mongoURI = process.env.MONGODB_URI;
mongoose.connect(
    mongoURI,
    { useNewUrlParser: true, useUnifiedTopology: true },
    function (err) {
        if (err) {
            console.error(`Failed to connect to MongoDB with URI: ${mongoURI}`);
            console.error(err.stack);
            process.exit(1);
        }
        console.log(`Connected to MongoDB with URI: ${mongoURI}`);
    }
);

// MQTT setup
const port = '8883';
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
const connectUrl = `mqtts://${process.env.MQTT_BROKER}:${port}`;
const client = mqtt.connect(connectUrl, {
    clientId,
    clean: true,
    connectTimeout: 4000,
    username: process.env.MQTT_USER_ID,
    password: process.env.MQTT_PASSWORD,
    reconnectPeriod: 1000,
});

// const client = mqtt.connect('mqtt://localhost'); // For development only

const circuitBreaker = new opossum(handleRequest, {
    errorThresholdPercentage: 75, // When 75% or more of requests fail, the circuit will open
    resetTimeout: 30000, // The circuit will automatically close after 30 seconds
    timeout: 7500, // The function will timeout after 7.5 seconds
});

client.on('connect', async () => {
    const topics = [
        registerUserTopic,
        registerDentistTopic,
        loginUserTopic,
        loginDentistTopic,
        modifyUserTopic,
        resetPasswordDentistTopic,
        resetPasswordUserTopic,
        sendEmailCodeTopic,
        authenticationTopic
    ];

    // Use a map function to create an array of Promises, one for each topic
    const subscriptions = topics.map((topic) => {
        return new Promise((resolve, reject) => {
            client.subscribe(topic, { qos: 2 }, (error) => {
                if (error) {
                    reject(error);
                } else {
                    console.log(`Subscribed to topic '${topic}'`);
                    resolve();
                }
            });
        });
    });

    // Wait for all of the subscriptions to complete
    await Promise.all(subscriptions);
    console.log('MQTT connected');
});

circuitBreaker.on('timeout', (error) => {
    console.error('Function execution timed out', error);
});

circuitBreaker.on('halfOpen', () => {
    console.log('Circuit breaker is half open');
});

circuitBreaker.on('open', () => {
    console.log('Circuit breaker is open');
});

client.on('message', async (topic, payload) => {
    await circuitBreaker.fire(topic, payload);
});

async function handleRequest(topic, payload) {
    console.log(topic);
    switch (topic) {
        case registerDentistTopic:
        case registerUserTopic:
            await registerUser(client, topic, payload);
            break;
        case loginDentistTopic:
        case loginUserTopic:
            login(client, topic, payload);
            break;
        case modifyUserTopic:
            modifyUser(client, topic, payload);
            break;
        case resetPasswordDentistTopic:
        case resetPasswordUserTopic:
            resetPassword(client, topic, payload);
            break;
        case sendEmailCodeTopic:
            sendEmailCode(client, transporter, topic, payload);
            break;
        case authenticationTopic:
            handleVerifyIdTokenRequest(topic, payload, client);
            break;
        default:
            console.log('Undefined topic');
    }
}

console.log('running...');
