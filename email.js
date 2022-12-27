module.exports = {
    async sendEmail(transporter, recipient, subject, text) {
        let mailOptions = {
            name: 'Dentistimo',
            from: '18359322033@163.com',
            to: recipient,
            subject: subject, // Subject line
            text: text,
            sendmail: true,
        };

        await transporter.sendMail(mailOptions, (error) => {
            if (error) {
                return console.log(error);
            }
        });
        console.log('Email sent!');
    },
};
