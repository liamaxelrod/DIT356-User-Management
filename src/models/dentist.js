const mongoose = require('mongoose');

const dentistSchema = new mongoose.Schema({
    dentistId: { type: Number, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, minlength: 8 },
    officeId: { type: Number, required: true },
    code: { type: String },
});

module.exports = Dentist = mongoose.model('dentist', dentistSchema);
