const express = require("express");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const { Parser } = require("json2csv");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// Database connection
const pool = new Pool({
    user: "my_postgres_dqrl_user",
    host: "dpg-ct6kl1dumphs739h8ga0-a.oregon-postgres.render.com",
    database: "my_postgres_dqrl",
    password: "kVesnrcNJAslyzXoCfUdess3b6OJ74cm",
    port: 5432,
    idleTimeoutMillis: 30000, // close idle clients after 30 seconds
    connectionTimeoutMillis: 5000, // wait for a maximum of 5 seconds for a connection
    ssl: {
        rejectUnauthorized: false, // Allows self-signed certificates
    },
});

// Function to create the table if it doesn't exist
const createTableIfNotExists = async () => {
    const createTableQuery = `
   CREATE TABLE IF NOT EXISTS translations (
    id SERIAL PRIMARY KEY,
    original_message TEXT NOT NULL,
    translated_message TEXT NOT NULL,
    language VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    ranking INT DEFAULT 0,
    rating FLOAT CHECK (rating BETWEEN 0 AND 5) DEFAULT 0,
    classification VARCHAR(50) DEFAULT 'translation',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

    `;

    try {
        await pool.query(createTableQuery);
        console.log('Table "translations" is ready.');
    } catch (error) {
        console.error("Error creating table:", error);
    }
};

// Create the table when the server starts
createTableIfNotExists();

// Route for handling POST requests
app.post("/api/translations", async (req, res) => {
    const {
        original_message,
        translated_message,
        language,
        model,
        ranking,
        rating,
        classification,
    } = req.body;
    if (!original_message || !translated_message || !language || !model) {
        res.status(400).json({ error: "Missing required fields" });
        return;
    }

    try {
        const result = await pool.query(
            "INSERT INTO translations (original_message, translated_message, language, model, ranking, rating, classification) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
            [
                original_message,
                translated_message,
                language,
                model,
                ranking,
                rating,
                classification,
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Database insertion error:", error);
        res.status(500).json({ error: "Database insertion error" });
    }
});

app.get("/api/export", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM translations"); // Modify query as needed
        const jsonData = result.rows;

        const json2csvParser = new Parser();
        const csv = json2csvParser.parse(jsonData);

        res.header("Content-Type", "text/csv");
        res.attachment("output_file.csv");
        res.send(csv);
    } catch (error) {
        console.error("Error exporting to CSV:", error);
        res.status(500).send("Internal Server Error");
    }
});
// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
