# **Enterprise Risk Register Backend**

## **Project structure**

```typescript
v1
	---database
		---utils
		cacheSetup.ts
		dbSetup.ts
		
	---middlewares
		token.ts
		authorize.ts
		
	---migrations

	---routers
		forgotPasswordRouter.ts
		loginRouter.ts
		logoutRouter.ts
		refreshTokenRouter.ts
		resetUserPasswordRouter.ts
		signUpRouter.ts
		usersRouter.ts
		rolesRouter.ts
		accessRolesRouter.ts
		
	---seeds

	---tests
		
	---utils
		checkCache.ts
		generateJwtToken.ts
		hashPassword.ts
		sendMail.ts
		validation.ts
		errors.ts
	
middlewares
	version.ts

index.ts
types.ts
knexfile.ts
tsconfig.json
commitlint.config.js
package.json
README.md
```

## **Dependencies**

1.  @upstash/redis: interact with hosted redis db
2.  bcrypt: hashing passwords
3.  dotenv: hide sensitive data
4.  express: node backend framework
5.  helmet: security headers
6.  cors: cross-origin request handling
7.  morgan: request logging
8.  jsonwebtoken: creating and using token to pass information between front and backend
9.  knex: query builder to track db migrations
10. nodemailer: send mail from code
11. pg: interact with postgres db
12. commitlint/cli: commit rules enforcing
13. joi - data validation
14. typescript: static typing, run via Bun

## **Middlewares**

1.  Version middlware:  looks for version header and direct to appropriate server. Found in ./middlewares/version.ts
2.  Token middlware: check for the token header in every request, checks validity, whether it is blacklisted, and whether the session was invalidated before forwarding to the next router. Found in v1/middlewares/token.ts
3.  Authorize middleware: checks the caller's granted global roles (see "Access control" in STRUCTURE.md) against the roles a route requires. Found in v1/middlewares/authorize.ts

# **Login**

**Endpoint**: baseUrl/login

```javascript
const payload = {
	"email": "doe@gmail.com",
	"password": "somepassword"
}
```

**Execution**

1.  Check whether user exists in the database. If not, send error message

```javascript
const user = await Users.getSingleUserByEmail(email)
```

2.  If the user is in the database, check if the passwords match, if not send error message

```javascript
bcrypt.compare(password, user.passwordHash, async function(err, result) {})
```

3.  If the passwords match, generate and send an access and refresh token to the user. Store refresh token in db.

```javascript
const {token, refreshToken} = generateJwtToken(payload, "all")
```

# **Logout**

**Endpoint:** baseUrl/logout

```javascript
const payload = {
	"token": "suhasdkhlhaskhaskchsd9eyf924yr92hfweodfh",
	"refreshToken": "sdgsDGSIdaSKDHASKDHI8y6r29r29r2sidfhasidh"
}
```

**Execution**

1.  Delete refresh token from the database

```javascript
await Tokens.deleteRefreshToken(refreshToken)
```

1.  Blacklist the access token by creating a key in the cache for it

```javascript
await Cache.set(`blacklist_${token}`, true, {ex: 900})
```

1.  Add the token to the blacklisted token table in the database

```javascript
await Tokens.blacklistToken(token)
```

# **Forgot password**

**Endpoint:** baseUrl/forgot-password

```javascript
const payload = {
	"email": "doe@gmail.com"
}
```

**Execution**

1.  Check if the email exists in the db, if not send and error message

```javascript
const user = await Users.getSingleUserByEmail(email)
```

2.  If the email exists, generate a forgot password token to be used during password reset

```javascript
const {forgotPasswordToken} = generateJwtToken(payload, "forgotPassword") 
```

3.  After generating the forgot password token, send to the user's email. This token will be provided when resetting the user's email.

```javascript
const sendRes = await sendPasswordResetMail({
	to: user.email,
	subject: 'ERR - Password Reset',
	html: `<p>${process.env.FRONTEND_URL}/reset-			        	password/${forgotPasswordToken}</p>`
})
```

# **Reset password**

**Endpoint:** baseUrl/reset-password/:token

```javascript
const payload = {
	"password": "somenewpassword"
}
```

**Execution:**

1.  Verify the token passed as parammeter

```javascript
jwt.verify(resetToken, process.env.FORGOT_PASSWORD_TOKEN_SECRET, async (err, user) => {})
```

2.  If the token is valid, hash the password passed in the request body

```javascript
const hashedPassword = await hashPassword(req.body.password);
```

3.  Update the hashed password in the database

```javascript
const updateRes = await Users.updateUserPassword(userObj)
```

# **Refresh access token**

**Endpoint**: baseUrl/token

```javascript
const payload = {
	"refreshToken": "hss79439y834hskhsdfkhd904u3r2ur02hdklfh"
}
```

**Execution:**

1.  Check if the refresh token is in the db

```javascript
const {refreshToken} = await Tokens.getRefreshToken(inputRefreshToken)
```

2.  Verify the refresh token

```javascript
jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {})
```

3.  If the token is valid, generate a new access token and send to the user

```javascript
const {token} = generateJwtToken(payload, "token")  
```
