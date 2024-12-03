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
    const [promptType, setPromptType] = useState("translation");

    const [error, setError] = useState("");
    const [showNotification, setShowNotification] = useState(false);
    const [translation, setTranslation] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [rankings, setRankings] = useState({});
    const [ratings, setRatings] = useState({});

    const googleGenAI = new GoogleGenerativeAI(
        import.meta.env.VITE_GOOGLE_API_KEY
    ); // Google API Key

    const configuration = new Configuration({
        apiKey: import.meta.env.VITE_OPENAI_KEY, // OpenAI API Key
    });
    const openai = new OpenAIApi(configuration);

    const deeplApiKey = import.meta.env.VITE_DEEPL_API_KEY; // DeepL API Key

    const deepLLanguageCodes = {
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
                        auth_key: import.meta.env.VITE_DEEPL_API_KEY, // Ensure this variable is defined
                        text: text,
                        source_lang: "EN", // Fixed to English source
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
        for (const model of models) {
            try {
                setIsLoading(true);

                // for (const model of models) {
                let translatedText = "";

                if (model.startsWith("gpt")) {
                    const response = await openai.createChatCompletion({
                        model: model,
                        messages: [
                            {
                                role: "system",
                                content: `Translate this sentence into ${language}`,
                            },
                            { role: "user", content: message },
                        ],
                        temperature: 0.3,
                        max_tokens: 100,
                    });
                    translatedText =
                        response.data.choices[0].message.content.trim();
                } else if (model.startsWith("gemini")) {
                    console.log("Model: " + model);

                    const genAIModel = googleGenAI.getGenerativeModel({
                        model: model,
                    });
                    const prompt = `Translate the text: ${message} into ${language} without description`;

                    const result = await genAIModel.generateContent(prompt);
                    const response = await result.response;
                    translatedText = await response.text();
                } else if (model === "deepl") {
                    translatedText = await translateWithDeepL(
                        message,
                        language
                    );
                }
                setTranslation(translatedText);

                setTranslations((prev) => ({
                    ...prev,
                    [model]: translatedText,
                }));
                //}

                setIsLoading(false);

                // Send translation result to the backend
                await fetch(
                    "https://translation-app-ooq8.onrender.com/api/translations",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            original_message: message,
                            translated_message: translatedText,
                            language: language,
                            model: model,
                        }),
                    }
                );
            } catch (error) {
                console.error("Translation error:", error);
                setError("Translation failed. Please try again.");
                setIsLoading(false);
            }
        }
    };

    const handleOnSubmit = (e) => {
        e.preventDefault();
        if (!formData.message) {
            setError("Please enter the message.");
            return;
        }
        translate();
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

    return (
        <div className="container">
            <div className="main">
                <h1>AI Model Comparision</h1>

                <form onSubmit={handleOnSubmit}>
                    {/* Static Language Selection */}
                    <div className="choiceslang">
                        <label htmlFor="language">Select Language:</label>
                        <select
                            id="language"
                            name="language"
                            value={formData.language}
                            onChange={handleInputChange}
                        >
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
                            <option value="translation">Translation</option>
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

                    <button type="submit">Translate</button>
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
                                <label>Rating:</label>
                                <div className="stars">
                                    <span className="star" data-value="1">
                                        &#9733;
                                    </span>
                                    <span className="star" data-value="2">
                                        &#9733;
                                    </span>
                                    <span className="star" data-value="5">
                                        &#9733;
                                    </span>
                                    <span className="star" data-value="4">
                                        &#9733;
                                    </span>
                                    <span className="star" data-value="3">
                                        &#9733;
                                    </span>
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
