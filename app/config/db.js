const {Pool} = require("pg")

const pool = new Pool({
    host: process.env.DB_host,
    port: process.env.DB_port,
    user: process.env.DB_user,
    password: process.env.DB_password,
    database: process.env.DB_database,
    timezone: 'Asia/Manila'
})

module.exports = pool