function getUserInfo(payload) {
    try {
        const userInfo = JSON.parse(payload.toString());
        return userInfo;
    } catch (error) {
        return null;
    }
}

module.exports = { getUserInfo };
