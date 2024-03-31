"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return _default;
    }
});
const _bcrypt = require("bcrypt");
const _jsonwebtoken = require("jsonwebtoken");
const _config = require("../config");
const _HttpException = require("../exceptions/HttpException");
const _usersmodel = /*#__PURE__*/ _interop_require_default(require("../models/users.model"));
const _util = require("../utils/util");
const _app = require("../app");
const _uid = /*#__PURE__*/ _interop_require_default(require("uid"));
const _moment = /*#__PURE__*/ _interop_require_default(require("moment"));
function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
let AuthService = class AuthService {
    async signup(userData) {
        if (!userData) throw new _HttpException.HttpException(400, 'userData is empty');
        const signupSession = (0, _app.initializeDbConnection)().session({
            database: 'neo4j'
        });
        const createWalletSession = (0, _app.initializeDbConnection)().session({
            database: 'neo4j'
        });
        const email = userData.email;
        try {
            const findUser = await signupSession.executeRead((tx)=>tx.run('match (u:user {email: $email}) return u', {
                    email: email
                }));
            if (findUser.records.length > 0) return {
                message: `This email ${userData.email} already exists`
            };
            const hashedPassword = await (0, _bcrypt.hash)(userData.password, 10);
            if (!userData.firstName || !userData.lastName || !userData.email || !userData.phoneNumber) return {
                message: 'mlissing data'
            };
            const createdUserBuyer = await signupSession.executeWrite((tx)=>tx.run('create (u:user {id: $userId, name: $name, email: $email, phone: $phoneNumber, createdAt: $createdAt}) return u', {
                    userId: _uid.default.uid(40),
                    createdAt: (0, _moment.default)().format('MMMM DD, YYYY'),
                    email: email,
                    phoneNumber: userData.phoneNumber,
                    name: `${userData.firstName} ${userData.lastName}`
                }));
            const buyerToken = this.createToken(process.env.EMAIL_SECRET, createdUserBuyer.records.map((record)=>record.get('u').properties.id)[0]);
            this.sendSignUpEmail(email);
            return {
                tokenData: buyerToken,
                data: createdUserBuyer.records.map((record)=>record.get('u').properties)[0]
            };
        } catch (error) {
            console.log(error);
        } finally{
            await signupSession.close();
            await createWalletSession.close();
        }
    }
    async sendSignUpEmail(email) {
        try {
            const mailOptions = {
                template: 'verifying_email',
                from: process.env.USER_EMAIL,
                to: process.env.USER_EMAIL,
                subject: 'Signup alert',
                context: {
                    email: email
                }
            };
            _app.transporter.sendMail(mailOptions, (error, data)=>{
                if (error) console.log(error);
                if (!error) console.log('sent');
            });
        } catch (error) {
            console.log(error);
        }
    }
    async resendVerificationEmail(email) {
        const getUserByEmailSession = (0, _app.initializeDbConnection)().session();
        try {
            const user = await getUserByEmailSession.executeRead((tx)=>tx.run("match (u:user {email: $email})-[:IS_A]->(b:buyer) return u, b", {
                    email: email
                }));
            const tokenData = this.createToken(process.env.EMAIL_SECRET, user.records.map((record)=>record.get('u').properties.id)[0]);
            const mailOptions = {
                template: 'verifying_email',
                from: process.env.USER,
                to: email,
                subject: 'Verifying Email',
                context: {
                    userName: user.records.map((record)=>record.get('u').properties.userName)[0],
                    token: tokenData.token,
                    domain: process.env.DOMAIN,
                    role: user.records.map((record)=>record.get('b').properties).length == 0 ? "Seller" : "Buyer"
                }
            };
            _app.transporter.sendMail(mailOptions, (error, data)=>{
                if (error) console.log(error);
                if (!error) console.log('sent');
            });
        } catch (error) {
            console.log(error);
        }
    }
    async changePassword(email, userData) {
        const checkUserSession = (0, _app.initializeDbConnection)().session();
        const changePasswordSession = (0, _app.initializeDbConnection)().session();
        try {
            const findUser = await checkUserSession.executeRead((tx)=>tx.run('match (u:user {email: $email}) return u', {
                    email: email
                }));
            if (findUser.records.length == 0) return {
                message: `old password is incorrect`
            };
            const password = findUser.records.map((record)=>record.get('u').properties.password)[0];
            const isPasswordMatching = await (0, _bcrypt.compare)(userData.data.oldPassword, password);
            if (!isPasswordMatching) return {
                message: 'old password is incorrect'
            };
            const hashedPassword = await (0, _bcrypt.hash)(userData.data.newPassword, 10);
            const changedPassword = await changePasswordSession.executeWrite((tx)=>tx.run('match (u {email: $email}) set u.password = $newPassword return u', {
                    email: email,
                    newPassword: hashedPassword
                }));
            return changedPassword.records.map((record)=>record.get('u').properties)[0];
        } catch (error) {
            console.log(error);
        } finally{
            changePasswordSession.close();
        }
    }
    async login(userData) {
        if ((0, _util.isEmpty)(userData)) throw new _HttpException.HttpException(400, 'userData is empty');
        const loginSession = (0, _app.initializeDbConnection)().session({
            database: 'neo4j'
        });
        try {
            const email = userData.data.email;
            const findUser = await loginSession.executeRead((tx)=>tx.run('match (u:user {email: $email}) return u', {
                    email: email
                }));
            if (findUser.records.length == 0) return {
                message: `password or email is incorrect`
            };
            const password = findUser.records.map((record)=>record.get('u').properties.password)[0];
            const isPasswordMatching = await (0, _bcrypt.compare)(userData.data.password, password);
            const userId = findUser.records.map((record)=>record.get('u').properties.id)[0];
            if (!isPasswordMatching) return {
                message: 'password or email is incorrect'
            };
            const tokenData = this.createToken(process.env.SECRET_KEY, userId);
            return {
                tokenData,
                data: findUser.records.map((record)=>record.get('u').properties)[0]
            };
        } catch (error) {
            console.log(error);
        } finally{
            loginSession.close();
        }
    }
    async refreshToken(id) {
        if (!id) return {
            message: 'missing token'
        };
        const refreshSession = (0, _app.initializeDbConnection)().session({
            database: 'neo4j'
        });
        try {
            const tokenData = this.createRefreshToken(id);
            return {
                tokenData
            };
        } catch (error) {
            console.log(error);
        } finally{
            refreshSession.close();
        }
    }
    async logout(userData) {
        if ((0, _util.isEmpty)(userData)) throw new _HttpException.HttpException(400, 'userData is empty');
        const findUser = this.users.find((user)=>user.email === userData.email && user.password === userData.password);
        if (!findUser) throw new _HttpException.HttpException(409, "User doesn't exist");
        return findUser;
    }
    createToken(secret, data) {
        try {
            const dataStoredInToken = {
                id: data
            };
            const secretKey = secret;
            const expiresAt = '280s';
            const expiresIn = new Date();
            console.log(expiresIn);
            expiresIn.setTime(expiresIn.getTime() + 60000);
            console.log(expiresIn);
            return {
                token: (0, _jsonwebtoken.sign)(dataStoredInToken, secretKey, {
                    expiresIn: expiresAt
                }),
                expiresIn: (0, _moment.default)(expiresIn).format("YYYY-MM-DD HH:mm:ss.ms")
            };
        } catch (error) {
            console.log(error);
        }
    }
    createRefreshToken(data) {
        try {
            const dataStoredInToken = {
                id: data,
                refresh: true
            };
            const secretKey = _config.SECRET_KEY;
            const expiresAt = '280s';
            const expiresIn = new Date();
            expiresIn.setTime(expiresIn.getTime() + 60);
            return {
                token: (0, _jsonwebtoken.sign)(dataStoredInToken, secretKey, {
                    expiresIn: expiresAt
                }),
                expiresIn: (0, _moment.default)(expiresIn).format("YYYY-MM-DD hh:mm:ss.ms")
            };
        } catch (error) {
            console.log(error);
        }
    }
    createCookie(tokenData) {
        return `Authorization=${tokenData.token}; HttpOnly; Max-Age=${tokenData.expiresIn};`;
    }
    constructor(){
        _define_property(this, "users", _usersmodel.default);
    }
};
const _default = AuthService;

//# sourceMappingURL=auth.service.js.map