import React, { useState } from "react";
import "./App.css";
import { Configuration, OpenAIApi } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { BeatLoader } from "react-spinners";

const App = () => {
    const [translations, setTranslations] = useState({});
    const [formData, setFormData] = useState({
        language: "French",
        message: "",
        model: "",
        classification: "translation",
    });
    // const [promptType, setPromptType] = useState("Translate");

    const [error, setError] = useState("");
    const [showNotification, setShowNotification] = useState(false);
    const [translation, setTranslation] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [rankings, setRankings] = useState({});
    const [ratings, setRatings] = useState({});

    const models = [
        "gpt-3.5-turbo",
        "gpt-4",
        "gpt-4-turbo",
        "gemini-1.5-pro-001",
        "gemini-1.5-flash-001",
        "gemini-1.5-pro-002",
        "gemini-1.5-flash-002",
        "deepl",
    ];

    const googleGenAI = new GoogleGenerativeAI(
        import.meta.env.VITE_GOOGLE_API_KEY
    ); // Google API Key

    const configuration = new Configuration({
        apiKey: import.meta.env.VITE_OPENAI_KEY,
    }); // OpenAI API Key
    const openai = new OpenAIApi(configuration);
    const deeplApiKey = import.meta.env.VITE_DEEPL_API_KEY; // DeepL API Key

    const deepLLanguageCodes = {
        English: "EN",
        Spanish: "ES",
        French: "FR",
        German: "DE",
        Italian: "IT",
        Dutch: "NL",
        Russian: "RU",
        "Chinese (Simplified)": "ZH",
        Japanese: "JA",
        Portuguese: "PT",
        Polish: "PL",
    };

    const exportToCSV = async () => {
        try {
            const response = await fetch(
                "https://translation-app-ooq8.onrender.com/api/export",
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            if (!response.ok) {
                throw new Error("Failed to export data to CSV");
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "output_file.csv"; // Specify the filename
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url); // Clean up URL object
        } catch (error) {
            console.error("Export error:", error);
            setError("Failed to export data. Please try again.");
        }
    };

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError("");
    };

    const translateWithDeepL = async (text, toLang) => {
        try {
            const targetLangCode = deepLLanguageCodes[toLang];
            if (!targetLangCode) {
                throw new Error(`Unsupported language: ${toLang}`);
            }

            const response = await fetch(
                `https://api-free.deepl.com/v2/translate`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: new URLSearchParams({
                        auth_key: deeplApiKey, // Ensure this variable is defined
                        text: text,
                        // Fixed to English source
                        target_lang: targetLangCode, // Use the mapped language code
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(
                    `DeepL API request failed with status ${response.status}`
                );
            }

            const data = await response.json();
            return data.translations[0].text;
        } catch (error) {
            console.error("DeepL Translation Error:", error);
            throw new Error(
                "Failed to translate with DeepL. Please check the API key, language codes, or try again later."
            );
        }
    };

    const translate = async () => {
        const { language, message } = formData;

        for (const model of models) {
            try {
                setIsLoading(true);
                let translatedText = "";
                if (model.startsWith("gpt")) {
                    const prompt = formData.classification.startsWith("t")
                        ? `Translate this sentence into ${language}`
                        : `Explain in short in ${language}`;
                    const response = await openai.createChatCompletion({
                        model: model,
                        messages: [
                            {
                                role: "system",
                                content: prompt,
                            },
                            { role: "user", content: message },
                        ],
                        temperature: 0.3,
                        max_tokens: 100,
                    });
                    translatedText =
                        response.data.choices[0].message.content.trim();
                } else if (model.startsWith("gemini")) {
                    const genAIModel = googleGenAI.getGenerativeModel({
                        model: model,
                    });
                    const prompt = formData.classification.startsWith("t")
                        ? `Translate the text: ${message} into ${language} without description`
                        : `${message} into ${language}, explain in short`;

                    const result = await genAIModel.generateContent(prompt);
                    const response = await result.response;
                    translatedText = await response.text();
                } else if (
                    model === "deepl" &&
                    formData.classification.startsWith("t")
                ) {
                    translatedText = await translateWithDeepL(
                        message,
                        language
                    );
                }
                // setTranslation(translatedText);

                setTranslations((prev) => ({
                    ...prev,
                    [model]: translatedText,
                }));

                setIsLoading(false);
            } catch (error) {
                console.error("Translation error:", error);
                setError("Translation failed. Please try again.");
                setIsLoading(false);
            }
        }
    };

    const sendDataToDatabase = async () => {
        const { language, message } = formData;

        for (const model of models) {
            try {
                // Send translations result to the backend
                await fetch(
                    "https://translation-app-ooq8.onrender.com/api/translations",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            original_message: message,
                            translated_message: translations[model],
                            language: language,
                            model: model,
                            ranking: rankings[model],
                            rating: ratings[model],
                            classification: formData.classification,
                        }),
                    }
                );
            } catch (error) {
                console.error("Error saving models:", error);
            }
        }
        console.log("All models saved successfully");
    };

    const handleOnGenerate = (e) => {
        e.preventDefault();
        if (!formData.message) {
            setError("Please enter the message.");
            return;
        }
        translate();
    };

    const handleOnSubmit = async () => {
        await sendDataToDatabase();
    };

    const handleCopy = () => {
        navigator.clipboard
            .writeText(translations)
            .then(() => displayNotification())
            .catch((err) => console.error("Failed to copy:", err));
    };

    const displayNotification = () => {
        setShowNotification(true);
        setTimeout(() => {
            setShowNotification(false);
        }, 3000);
    };

    const handleRankingChange = (model, value) => {
        setRankings((prev) => ({ ...prev, [model]: value }));
    };

    const handleRatingChange = (model, value) => {
        setRatings((prev) => ({ ...prev, [model]: value }));
    };
    const renderStars = (model) => {
        const totalStars = 5; // Adjust the number of stars if necessary
        const stars = [];

        for (let i = 1; i <= totalStars; i++) {
            stars.push(
                <span
                    key={i}
                    className={`star ${ratings[model] >= i ? "selected" : ""}`} // Corrected here
                    data-value={i}
                    onClick={() => handleRatingChange(model, i)} // Corrected here
                >
                    &#9733;
                </span>
            );
        }
        return stars;
    };

    return (
        <div className="container">
            <div className="main">
                <h1>AI Model Comparision</h1>

                <form>
                    {/* Static Language Selection */}
                    <div className="choiceslang">
                        <label htmlFor="language">Select Language:</label>
                        <select
                            id="language"
                            name="language"
                            value={formData.language}
                            onChange={handleInputChange}
                        >
                            <option value="English">English</option>
                            <option value="Spanish">Spanish</option>
                            <option value="French">French</option>
                            <option value="German">German</option>
                            <option value="Italian">Italian</option>
                            <option value="Portuguese">Portuguese</option>
                            <option value="Dutch">Dutch</option>
                            <option value="Russian">Russian</option>
                            <option value="Chinese (Simplified)">
                                Chinese (Simplified)
                            </option>
                            <option value="Japanese">Japanese</option>
                            <option value="Korean">Korean</option>
                            <option value="Arabic">Arabic</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="classification">
                            Select Classification:
                        </label>
                        <select
                            name="classification"
                            value={formData.classification}
                            onChange={handleInputChange}
                        >
                            <option value="translate">Translation</option>
                            <option value="question">Question</option>
                        </select>
                    </div>

                    {/* Message Input */}
                    <textarea
                        name="message"
                        placeholder="Type your message here..."
                        value={formData.message}
                        onChange={handleInputChange}
                    ></textarea>

                    {error && <div className="error">{error}</div>}

                    <button type="button" onClick={handleOnGenerate}>
                        Generate
                    </button>
                    <button type="button" onClick={handleOnSubmit}>
                        Submit
                    </button>
                </form>

                <button onClick={exportToCSV} className="export-btn">
                    Export to CSV
                </button>
            </div>

            <div className="sidebar">
                <h2 style={{ color: "white", fontSize: "32px" }}>
                    Generated results with different models
                </h2>
                <div
                    className="choices"
                    style={{ display: "flex", flexWrap: "wrap" }}
                >
                    {[
                        "gpt-3.5-turbo",
                        "gpt-4",
                        "gpt-4-turbo",
                        "gemini-1.5-pro-001",
                        "gemini-1.5-flash-001",
                        "gemini-1.5-pro-002",
                        "gemini-1.5-flash-002",
                        "deepl",
                    ].map((model) => (
                        <div
                            key={model}
                            className="card"
                            style={{ flex: "1 0 45%", margin: "10px" }}
                        >
                            <h3>{model}</h3>
                            <div className="translation">
                                {translations[model] || "No translation yet"}
                            </div>
                            <div className="ranking-rating">
                                <label>
                                    Rank:
                                    <input
                                        type="number"
                                        value={rankings[model] || ""}
                                        onChange={(e) =>
                                            handleRankingChange(
                                                model,
                                                e.target.value
                                            )
                                        }
                                        min="1"
                                        max="8"
                                    />
                                </label>

                                <div>
                                    <label>Rating:</label>
                                    <div className="stars">
                                        {renderStars(model)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    <div
                        className={`notification ${
                            showNotification ? "active" : ""
                        }`}
                    >
                        Copied to clipboard!
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;
