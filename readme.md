# qtc-mdm-test

> 

## About

This project uses [Feathers](http://feathersjs.com). An open source framework for building APIs and real-time applications.

## Getting Started

1. Make sure you have [NodeJS](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed.
2. Install your dependencies

    ```
    cd path/to/qtc-mdm-test
    npm install
    ```

3. Start your app

    ```
    npm run compile # Compile TypeScript source
    npm run migrate # Run migrations to set up the database
    npm start
    ```

## Testing

Run `npm test` and all your tests in the `test/` directory will be run.

## Scaffolding

This app comes with a powerful command line interface for Feathers. Here are a few things it can do:

```
$ npx feathers help                           # Show all commands
$ npx feathers generate service               # Generate a new Service
```

## Help

For more information on all the things you can do with Feathers visit [docs.feathersjs.com](http://docs.feathersjs.com).

## Login authentication (simple)

This project now supports login via Feathers authentication using email/password and JWT.

- Login endpoint: `POST /authentication`
- Request body:

```json
{
    "strategy": "local",
    "email": "admin@example.com",
    "password": "ChangeMe123!"
}
```

- Response includes `accessToken`
- Use token for protected admin APIs:

```
Authorization: Bearer <accessToken>
```

### Required database table

Run [docs/login-table.sql](docs/login-table.sql) in your Postgres database.
It creates the `users` table and inserts one sample admin user.
