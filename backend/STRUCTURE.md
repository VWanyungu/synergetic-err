1. Naming
- standard

2. Response structures
{
                    status: "success",
                    data: {response},
                    message: "Users retrieved successfully"
                }

3. Status codes
200 - success, 500 - server error, 400 - input error, 404 - not found

4. Versioning
- version check middleware

5. Pagination
- page and limit set in queries

6. Authentication
 - tokens created on login, deleted on logout, refresh token stored in db
 - admin can force a re-login by invalidating a user's sessions (tokens_invalidated_at)

7. Access control
- user's global role grants loaded from the `roles` table onto the JWT at login/refresh
- `authorize([roleNames])` middleware checks the caller's grants against a route's required roles; `Admin` bypasses all checks
- grantable role names live in the `access_role` catalog table, managed via /access-roles

8. Validation
- Joi schemas in v1/utils/validation.ts

9. Hashing
- bcrypt

10. Rate limiting
 - to be done at reverse proxy level