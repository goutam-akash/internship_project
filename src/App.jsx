import React, { useState } from "react";
import "./App.css";
import { Configuration, OpenAIApi } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { BeatLoader } from "react-spinners";

const App = () => {
  const [formData, setFormData] = useState({
    language: "French",
    message: "",
    model: "gemini-1.5-flash",
  });
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

  const supportedLanguages = {
    "gpt-3.5-turbo": ["Spanish", "French", "German", "Italian", "Portuguese", "Dutch", "Russian", "Chinese (Simplified)", "Japanese"],
    "gpt-4": ["Spanish", "French", "Telugu", "German", "Italian", "Portuguese", "Dutch", "Russian", "Chinese (Simplified)", "Japanese", "Korean"],
    "gpt-4-turbo": ["Spanish", "French", "Telugu", "Japanese", "German", "Italian", "Portuguese", "Dutch", "Russian", "Chinese (Simplified)", "Korean", "Arabic"],
    "gemini-1.5-pro-001": ["Spanish", "French", "German", "Italian", "Portuguese", "Dutch", "Russian", "Chinese (Simplified)"],
    "gemini-1.5-flash-001": ["Spanish", "French", "German", "Italian", "Portuguese", "Dutch", "Russian", "Chinese (Simplified)"],
    "gemini-1.5-pro-002": ["Spanish", "French", "German", "Italian", "Portuguese", "Dutch", "Russian", "Chinese (Simplified)", "Japanese", "Korean"],
    "gemini-1.5-flash-002": ["Spanish", "French", "German", "Italian", "Portuguese", "Dutch", "Russian", "Chinese (Simplified)", "Japanese", "Korean", "Arabic"],
    "deepl": ["Spanish", "French", "Japanese", "German", "Italian", "Dutch", "Russian", "Chinese (Simplified)", "Polish", "Portuguese"],
  };
  const deepLLanguageCodes = {
    "Spanish": "ES",
    "French": "FR",
    "German": "DE",
    "Italian": "IT",
    "Dutch": "NL",
    "Russian": "RU",
    "Chinese (Simplified)": "ZH",
    "Japanese": "JA",
    "Portuguese": "PT",
    "Polish": "PL",
  };
  const exportToCSV = async () => {
    try {
      const response = await fetch("https://translation-app-ooq8.onrender.com/api/export", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

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
  
      const response = await fetch(`https://api-free.deepl.com/v2/translate`, {
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
      });
  
      if (!response.ok) {
        throw new Error(`DeepL API request failed with status ${response.status}`);
      }
  
      const data = await response.json();
      return data.translations[0].text;
    } catch (error) {
      console.error("DeepL Translation Error:", error);
      throw new Error("Failed to translate with DeepL. Please check the API key, language codes, or try again later.");
    }
  };
  

  const translate = async () => {
    const { language, message, model } = formData;

    try {
      setIsLoading(true);

      let translatedText = "";

      if (model.startsWith("gpt")) {
        const response = await openai.createChatCompletion({
          model: model,
          messages: [
            {
              role: "system",
              content: `Translate this sentence into ${language}.`,
            },
            { role: "user", content: message },
          ],
          temperature: 0.3,
          max_tokens: 100,
        });
        translatedText = response.data.choices[0].message.content.trim();
      } else if (model.startsWith("gemini")) {
        const genAIModel = googleGenAI.getGenerativeModel({
          model: "gemini-1.5-flash",
        });
          const prompt = `Translate the text: ${message} into ${language}`;

          const result = await genAIModel.generateContent(prompt);
          const response = await result.response;
          const text = response.text();
          
          translatedText = response.text();
      
      } else if (model === "deepl") {
        translatedText = await translateWithDeepL(message, language);
        
      }

      setTranslation(translatedText);
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
      .writeText(translation)
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
        <h1>Translation App</h1>
        <div>
          <h3>Selected Model: {formData.model}</h3>
        </div>
        <form onSubmit={handleOnSubmit}>
          {/* To Language Selection */}
          <div className="choiceslang">
            <label htmlFor="toLanguage">To:</label>
            <select
              id="language"
              name="language"
              value={formData.language}
              onChange={handleInputChange}
            >
              {supportedLanguages[formData.model]?.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
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
        <h2>Models</h2>
        <div className="choices" style={{ display: 'flex', flexWrap: 'wrap',color: 'black' }}>
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
            <div key={model} className="card" style={{ flex: '1 0 45%', margin: '10px' }}>
              <h3>{model}</h3>
              <div className="translation">
                <div className="copy-btn" onClick={handleCopy} title="Copy to clipboard">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-6 h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.75 4.5H15a.75.75 0 01.75.75v0c0 .212-.03.418-.084.612m-7.332 0c-.646-.049-1.288-.11-1.927-.184-1.1-.128-1.907-1.077-1.907-2.185V4.5a2.25 2.25 0 012.25-2.25h9a2.25 2.25 0 012.25 2.25v0c0 1.108-.806 2.057-1.907 2.185a48.208 48.208 0 01-1.927.184M7.5 4.5v15m7.5-15v15m3.375-11.25c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                    />
                  </svg>
                </div>
                {isLoading ? <BeatLoader size={12} color={"red"} /> : translation}
              </div>
              <div className="ranking-rating" style={{color:'black'}}>
                <label>
                  Rank: 
                  <input 
                    type="number" 
                    value={rankings[model] || ''} 
                    onChange={(e) => handleRankingChange(model, e.target.value)} 
                    min="1" 
                    max="8"
                  />
                </label>
                <label>
                  Rating: 
                  <input 
                    type="number" 
                    value={ratings[model] || ''} 
                    onChange={(e) => handleRatingChange(model, e.target.value)} 
                    min="1" 
                    max="10"
                  />
                </label>
              </div>
            </div>
          ))}
          <div className={`notification ${showNotification ? "active" : ""}`}>
            Copied to clipboard!
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
