import { useEffect, useRef, useState } from "react";
import "./App.css";
import fr from "./locales/fr";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
// Temporary Dealer and Enquiry URLs
const DEALER_URL = "https://example.com/dealer";
const ENQUIRY_URL = "https://example.com/enquiry";
const getProductImageUrl = (imageName) => {
  if (!imageName) {
    return null;
  }

  const cleanImageName = String(imageName).trim();

  if (!cleanImageName) {
    return null;
  }

  return `${API_BASE_URL}/product-images/${encodeURIComponent(
    cleanImageName
  )}`;
};

const getOptionDisplayLabel = (option, language) => {
  const originalOption = String(option).trim();

  if (language !== "fr") {
    return originalOption;
  }

  const frenchLabels = {
    Card: "Carte",
    Table: "Tableau",
  };

  return frenchLabels[originalOption] || originalOption;
};

const openDealerPage = () => {
  window.open(DEALER_URL, "_blank", "noopener,noreferrer");
};

const openEnquiryPage = () => {
  window.open(ENQUIRY_URL, "_blank", "noopener,noreferrer");
};

function App() {
  // =========================================================
  // CHAT WINDOW
  // =========================================================

  const [isChatOpen, setIsChatOpen] = useState(true);

  // =========================================================
  // MESSAGE INPUT
  // =========================================================

  const [message, setMessage] = useState("");

  // =========================================================
  // CHAT MESSAGES
  // =========================================================

  const [messages, setMessages] = useState(() => {
    try {
      const savedMessages = localStorage.getItem(
        "catalog_chat_messages"
      );

      return savedMessages ? JSON.parse(savedMessages) : [];
    } catch (error) {
      console.error("Failed to restore chat messages:", error);
      return [];
    }
  });

  const [conversationId, setConversationId] = useState(() => {
    try {
      let savedId = localStorage.getItem(
        "catalog_conversation_id"
      );

      if (!savedId) {
        savedId = crypto.randomUUID();
        localStorage.setItem("catalog_conversation_id", savedId);
      }

      return savedId;
    } catch (error) {
      console.error("Failed to restore conversation ID:", error);
      return crypto.randomUUID();
    }
  });

  const [chatHistory, setChatHistory] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("catalog_chat_history") || "[]");
      if (Array.isArray(saved) && saved.length) return saved;
      const oldMessages = JSON.parse(localStorage.getItem("catalog_chat_messages") || "[]");
      const oldId = localStorage.getItem("catalog_conversation_id");
      if (Array.isArray(oldMessages) && oldMessages.length) {
        const firstUser = oldMessages.find((item) => item.sender === "user");
        return [{
          id: oldId || crypto.randomUUID(),
          title: firstUser?.text || "Previous conversation",
          messages: oldMessages,
          updatedAt: Date.now(),
        }];
      }
      return [];
    } catch (error) {
      console.error("Failed to restore chat history:", error);
      return [];
    }
  });

  const [language, setLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem("catalog_language");
    return savedLanguage === "fr" ? "fr" : "en";
  });
  const dealerLabel =
    language === "fr" ? "Distributeur" : "Dealer";

  const enquiryLabel =
    language === "fr"
      ? "Demande de renseignements"
      : "Enquiry";
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [translatedOptions, setTranslatedOptions] = useState({});
  

  // =========================================================
  // LOADING
  // =========================================================

  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);

  // =========================================================
  // MESSAGE AREA REF
  // =========================================================

  const messagesEndRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const speechSynthesisRef = useRef(null);
  const currentUtteranceRef = useRef(null);

  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const [playedMessageIds, setPlayedMessageIds] = useState(new Set());

  // =========================================================
  // AUTO SCROLL
  // =========================================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  useEffect(() => {
    if ("speechSynthesis" in window) {
      speechSynthesisRef.current = window.speechSynthesis;
    }

    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }

      currentUtteranceRef.current = null;
    };
  }, []);


  useEffect(() => {
    try {
      localStorage.setItem(
        "catalog_chat_messages",
        JSON.stringify(messages)
      );
    } catch (error) {
      console.error("Failed to save chat messages:", error);
    }
  }, [messages]);

  useEffect(() => {
    if (!messages.length) return;
    setChatHistory((previous) => {
      const firstUser = messages.find((item) => item.sender === "user");
      const session = {
        id: conversationId,
        title: String(firstUser?.text || "New conversation").slice(0, 42),
        messages,
        updatedAt: Date.now(),
      };
      return [session, ...previous.filter((item) => item.id !== conversationId)].slice(0, 30);
    });
  }, [messages, conversationId]);

  useEffect(() => {
    try {
      localStorage.setItem("catalog_chat_history", JSON.stringify(chatHistory));
    } catch (error) {
      console.error("Failed to save chat history:", error);
    }
  }, [chatHistory]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "catalog_conversation_id",
        conversationId
      );
    } catch (error) {
      console.error("Failed to save conversation ID:", error);
    }
  }, [conversationId]);

  // Save selected language
  useEffect(() => {
    localStorage.setItem("catalog_language", language);
  }, [language]);
  // =========================================================
  // START VOICE RECORDING
  // =========================================================

  const startRecording = async () => {
    stopSpeech();
    if (isLoading || isRecording) {
      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      audioChunksRef.current = [];

      const mediaRecorder =
        new MediaRecorder(stream);

      mediaRecorderRef.current =
        mediaRecorder;

      mediaRecorder.ondataavailable = (
        event
      ) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(
            event.data
          );
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob =
          new Blob(
            audioChunksRef.current,
            {
              type:
                mediaRecorder.mimeType ||
                "audio/webm",
            }
          );

        // Stop microphone
        stream
          .getTracks()
          .forEach((track) => {
            track.stop();
          });

        await sendVoiceToBackend(
          audioBlob
        );
      };

      mediaRecorder.start();

      setIsRecording(true);

    } catch (error) {

      console.error(
        "Microphone access failed:",
        error
      );

      alert(
        "Microphone permission is required."
      );
    }
  };

  // =========================================================
  // STOP VOICE RECORDING
  // =========================================================

  const stopRecording = () => {
    if (
      !mediaRecorderRef.current ||
      !isRecording
    ) {
      return;
    }

    mediaRecorderRef.current.stop();

    setIsRecording(false);
  };

  // =========================================================
  // SEND VOICE TO BACKEND
  // =========================================================

  const sendVoiceToBackend = async (
    audioBlob
  ) => {

    setIsVoiceProcessing(true);

    try {

      const formData =
        new FormData();

      formData.append(
        "audio",
        audioBlob,
        "recording.webm"
      );

      const response =
        await fetch(
          `${API_BASE_URL}/api/voice`,
          {
            method: "POST",
            body: formData,
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
          data.message ||
          "Voice transcription failed."
        );
      }

      const voiceData =
        data.data || {};

      const transcribedText =
        voiceData.text || "";

      const detectedLanguage =
        voiceData.language || "";

      console.log(
        "Voice text:",
        transcribedText
      );

      console.log(
        "Detected language:",
        detectedLanguage
      );

      // Put transcription into textbox
      setMessage(
        transcribedText
      );

    } catch (error) {

      console.error(
        "Voice request failed:",
        error
      );

      alert(
        "Could not convert your voice to text."
      );

    } finally {

      setIsVoiceProcessing(false);
    }
  };

  // =========================================================
  // SEND MESSAGE
  // =========================================================
  
  const stopSpeech = () => {
    if (speechSynthesisRef.current) {
      speechSynthesisRef.current.cancel();
    }

    currentUtteranceRef.current = null;
    setSpeakingMessageId(null);
  };
  
  const speakMessage = (chatMessage) => {
    if (!chatMessage?.text) return;

    if (!("speechSynthesis" in window)) {
      console.warn("Browser does not support Speech Synthesis.");
      return;
    }

    const synthesis = speechSynthesisRef.current || window.speechSynthesis;

    // If the same message is currently speaking, stop it
    if (speakingMessageId === chatMessage.id) {
      stopSpeech();
      return;
    }

    // Stop any previously playing message
    synthesis.cancel();

    const text = String(chatMessage.text).trim();

    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.onstart = () => {
      setSpeakingMessageId(chatMessage.id);
    };

    utterance.onend = () => {
      if (currentUtteranceRef.current === utterance) {
        currentUtteranceRef.current = null;
        setSpeakingMessageId(null);

        setPlayedMessageIds((previousIds) => {
          const updatedIds = new Set(previousIds);
          updatedIds.add(chatMessage.id);
          return updatedIds;
        });
      }
    };

    utterance.onerror = () => {
      if (currentUtteranceRef.current === utterance) {
        currentUtteranceRef.current = null;
        setSpeakingMessageId(null);
      }
    };

    currentUtteranceRef.current = utterance;

    setSpeakingMessageId(chatMessage.id);

    synthesis.speak(utterance);
  };

  
  
  const translateOptionsForDisplay = async (options, field) => {
    const translatableFields = ["category", "product", "product_type", "engine"];

    if (
      language !== "fr" ||
      !Array.isArray(options) ||
      !translatableFields.includes(String(field).toLowerCase())
    ) {
      return {};
    }

    const uniqueOptions = [
      ...new Set(
        options
          .filter((option) => option !== null && option !== undefined)
          .map((option) => String(option).trim())
          .filter(Boolean)
      ),
    ];

    if (uniqueOptions.length === 0) {
      return {};
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/translate-options`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            options: uniqueOptions,
            language: "fr",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error("Option translation request failed.");
      }

      const translated = data.data?.translated_options || [];
      const mapping = {};

      uniqueOptions.forEach((option, index) => {
        mapping[option] = translated[index] ?? option;
      });

      return mapping;
    } catch (error) {
      console.error("Dynamic option translation failed:", error);
      return {};
    }
  };

  
  
  const translateEngineForDisplay = async (engineValue, optionLabels = {}) => {
    const originalEngine = String(engineValue ?? "").trim();

    if (!originalEngine || language !== "fr") {
      return originalEngine;
    }

    // Reuse an existing translation when the exact engine option matches.
    if (optionLabels[originalEngine]) {
      return optionLabels[originalEngine];
    }

    // Otherwise, use the existing M2M100-backed translation endpoint.
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/translate-options`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            options: [originalEngine],
            language: "fr",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error("Engine translation request failed.");
      }

      return data.data?.translated_options?.[0] || originalEngine;
    } catch (error) {
      console.error("Engine display translation failed:", error);
      return originalEngine;
    }
  };



  const sendMessage = async (selectedMessage = null, displayLabel = null, isOptionSelection = false) => {
    // -------------------------------------------------------
    // DETERMINE MESSAGE
    // -------------------------------------------------------

    const textToSend =
      selectedMessage !== null
        ? String(selectedMessage).trim()
        : message.trim();

    // -------------------------------------------------------
    // EMPTY MESSAGE
    // -------------------------------------------------------

    if (!textToSend) {
      return;
    }

    // -------------------------------------------------------
    // PREVENT DOUBLE REQUEST
    // -------------------------------------------------------

    if (isLoading) {
      return;
    }

    stopSpeech();

    // -------------------------------------------------------
    // ADD USER MESSAGE
    // -------------------------------------------------------

    setMessages((previousMessages) => [
      ...previousMessages,
      {
        id: Date.now() + Math.random(),
        sender: "user",
        text: displayLabel ?? textToSend,
      },
    ]);

    // -------------------------------------------------------
    // CLEAR INPUT
    // -------------------------------------------------------

    setMessage("");

    // -------------------------------------------------------
    // START LOADING
    // -------------------------------------------------------

    setIsLoading(true);

    try {
      // =====================================================
      // CALL BACKEND
      // =====================================================

      const response = await fetch(
        `${API_BASE_URL}/api/chat`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: textToSend,
            conversation_id: conversationId,
            language: language,
            is_option_selection: isOptionSelection,
          }),

        }
      );

      // =====================================================
      // READ JSON
      // =====================================================

      const data = await response.json();

      // =====================================================
      // BACKEND ERROR
      // =====================================================

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            data.message ||
            "Something went wrong."
        );
      }

      // =====================================================
      // BACKEND DATA
      // =====================================================

      const backendData = data.data || {};

      const result = backendData.result || {};

      // =====================================================
      // AI MESSAGE
      // =====================================================

      let aiText = "";

      if (
        result.message !== undefined &&
        result.message !== null &&
        String(result.message).trim() !== ""
      ) {
        aiText = String(result.message);
      } else if (
        result.question !== undefined &&
        result.question !== null &&
        String(result.question).trim() !== ""
      ) {
        aiText = String(result.question);
      } else {
        aiText =
          "I received your request, but I could not generate a response.";
      }

      // =====================================================
      // DYNAMIC OPTIONS
      // =====================================================

      let options = [];

      if (Array.isArray(result.options)) {
        options = result.options;
      } else if (Array.isArray(backendData.options)) {
        options = backendData.options;
      }

      // -------------------------------------------------------
      // REMOVE EMPTY OPTIONS
      // -------------------------------------------------------

      options = options.filter(
        (option) =>
          option !== null &&
          option !== undefined &&
          String(option).trim() !== ""
      );
      const optionLabels = await translateOptionsForDisplay(
        options,
        result.field || backendData.field
      );

      // =====================================================
      // ACTION
      // =====================================================

      const action =
        result.action ||
        backendData.action ||
        null;

      // =====================================================
      // FIELD
      // =====================================================

      const field =
        result.field ||
        backendData.field ||
        null;

      const presentationFormat =
        result.presentation_format ||
        backendData.presentation_format ||
        null;

      // =====================================================
      // RAW RECORDS
      // =====================================================

      const records = Array.isArray(result.records)
        ? result.records
        : Array.isArray(backendData.records)
        ? backendData.records
        : [];

      // =====================================================
      // FRONTEND MAPPED RECORDS
      // =====================================================
      //
      // Backend FrontendMapper should provide:
      //
      // frontend_records
      //
      // Example:
      //
      // {
      //   "Image": "...",
      //   "Part Number": "...",
      //   "Engine": "...",
      //   "OEM": "BMW",
      //   "Model": "X5",
      //   "Year": "2021"
      // }
      //
      // =====================================================

      let frontendRecords = [];

      if (Array.isArray(result.frontend_records)) {
        frontendRecords = result.frontend_records;
      } else if (
        Array.isArray(backendData.frontend_records)
      ) {
        frontendRecords = backendData.frontend_records;
      }

      // =====================================================
      // SUPPORT SINGLE FRONTEND RECORD
      // =====================================================

      if (
        frontendRecords.length === 0 &&
        result.frontend_record &&
        typeof result.frontend_record === "object"
      ) {
        frontendRecords = [
          result.frontend_record,
        ];
      }

      if (
        frontendRecords.length === 0 &&
        backendData.frontend_record &&
        typeof backendData.frontend_record === "object"
      ) {
        frontendRecords = [
          backendData.frontend_record,
        ];
      }

      // =====================================================
      // CLEAN FRONTEND RECORDS
      // =====================================================

      frontendRecords = frontendRecords.filter(
        (record) =>
          record &&
          typeof record === "object" &&
          !Array.isArray(record)
      );

      // =====================================================
      // DEBUG
      // =====================================================

      console.log(
        "Frontend mapped records:",
        frontendRecords
      );

      // =====================================================
      // TRANSLATE ENGINE VALUES FOR DISPLAY
      // =====================================================

      let engineLabels = {};

      if (language === "fr" && frontendRecords.length > 0) {
        const engineValues = [
          ...new Set(
            frontendRecords
              .map((record) => record.Engine)
              .filter(
                (value) =>
                  value !== null &&
                  value !== undefined &&
                  String(value).trim() !== ""
              )
              .map((value) => String(value).trim())
          ),
        ];

        if (engineValues.length > 0) {
          try {
            const response = await fetch(
              `${API_BASE_URL}/api/translate-options`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  options: engineValues,
                  language: "fr",
                }),
              }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
              throw new Error("Engine translation request failed.");
            }

            const translatedEngines =
              data.data?.translated_options || [];

            engineValues.forEach((engine, index) => {
              engineLabels[engine] =
                translatedEngines[index] || engine;
            });
          } catch (error) {
            console.error(
              "Engine display translation failed:",
              error
            );
          }
        }
      }

      // =====================================================
      // ADD AI MESSAGE
      // =====================================================

      const aiMessage = {
        id: Date.now() + Math.random(),

        sender: "ai",

        text: aiText,

        // Dynamic AI options
        options: options,
        optionLabels: optionLabels,
        engineLabels: engineLabels,
        // Conversation information
        action: action,

        field: field,

        presentationFormat: presentationFormat,

        // Raw records
        records: records,

        // Frontend mapped records
        frontendRecords: frontendRecords,
        
      };

      setMessages((previousMessages) => [
        ...previousMessages,
        aiMessage,
      ]);

      // Automatically speak the AI response
      speakMessage(aiMessage);
    } catch (error) {
      // =====================================================
      // ERROR
      // =====================================================

      console.error(
        "Backend request failed:",
        error
      );

      setMessages((previousMessages) => [
        ...previousMessages,

        {
          id: Date.now() + Math.random(),

          sender: "ai",

          text:
            "Sorry, I couldn't connect to the AI Product Catalog.",

          options: [],

          frontendRecords: [],
        },
      ]);
    } finally {
      // =====================================================
      // STOP LOADING
      // =====================================================

      setIsLoading(false);
    }
  };

  // =========================================================
  // OPTION CLICK
  // =========================================================
    
  const handleOptionClick = (option, optionLabels = {}) => {
    if (isLoading) {
      return;
    }

    const selectedOption = String(option).trim();

    if (!selectedOption) {
      return;
    }

    const displayLabel =
      optionLabels[selectedOption] ||
      getOptionDisplayLabel(selectedOption, language);

    sendMessage(selectedOption, displayLabel, true);
  };
  
  // =========================================================
  // ENTER KEY
  // =========================================================

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();

      if (!isLoading) {
        sendMessage();
      }
    }
  };

  // =========================================================
  // RESET CHAT
  // =========================================================

  const resetChat = async () => {
    if (isLoading) {
      return;
    }

    try {
      setIsLoading(true);

      // -----------------------------------------------------
      // RESET BACKEND
      // -----------------------------------------------------

      const response = await fetch(
        `${API_BASE_URL}/api/reset`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversation_id: conversationId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Failed to reset conversation."
        );
      }

      // -----------------------------------------------------
      // RESET FRONTEND
      // -----------------------------------------------------

      setMessages([]);
      setChatHistory((previous) =>
        previous.map((session) =>
          session.id === conversationId
            ? { ...session, messages: [], title: "New conversation" }
            : session
        )
      );
      setMessage("");
    } catch (error) {
      console.error(
        "Reset failed:",
        error
      );

      setMessages((previousMessages) => [
        ...previousMessages,

        {
          id: Date.now() + Math.random(),

          sender: "ai",

          text:
            "I couldn't reset the conversation.",

          options: [],

          frontendRecords: [],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================
  // NEW CHAT AND CHAT HISTORY
  // =========================================================

  const startNewChat = () => {
    if (isLoading) return;
    stopSpeech();
    setConversationId(crypto.randomUUID());
    setMessages([]);
    setMessage("");
    setShowLanguageMenu(false);
  };

  const openHistoryChat = (session) => {
    if (isLoading || !session) return;
    stopSpeech();
    setConversationId(session.id);
    setMessages(session.messages || []);
    setMessage("");
    setShowLanguageMenu(false);
  };

  // =========================================================
  // CLOSE CHAT
  // =========================================================

  const closeChat = () => {
    setIsChatOpen(false);
  };

  // =========================================================
  // OPEN CHAT
  // =========================================================

  const openChat = () => {
    setIsChatOpen(true);
  };

  // =========================================================
  // IMAGE HELPER
  // =========================================================

  const getImageSource = (imageValue) => {
    if (!imageValue) {
      return null;
    }

    const imageString = String(imageValue).trim();

    if (!imageString) {
      return null;
    }

    // -------------------------------------------------------
    // Already a complete URL
    // -------------------------------------------------------

    if (
      imageString.startsWith("http://") ||
      imageString.startsWith("https://") ||
      imageString.startsWith("data:image/")
    ) {
      return imageString;
    }

    // -------------------------------------------------------
    // Already backend product-image path
    // Example:
    // /product-images/5pk.jpg
    // -------------------------------------------------------

    if (
      imageString.startsWith("/product-images/")
    ) {
      return `${API_BASE_URL}${imageString}`;
    }

    // -------------------------------------------------------
    // Image filename from database
    // Example:
    // 5pk.jpg
    //
    // Convert to:
    // http://127.0.0.1:8000/product-images/5pk.jpg
    // -------------------------------------------------------

    const cleanFileName =
      imageString.startsWith("/")
        ? imageString.substring(1)
        : imageString;

    return `${API_BASE_URL}/product-images/${encodeURIComponent(
      cleanFileName
    )}`;
  };
    
  // =========================================================
  // PRODUCT DETAILS CARD
  // =========================================================

  const ProductDetailsCard = ({
    record,
    index,
    optionLabels,
    engineLabels,
  }) => {
    if (!record || typeof record !== "object") {
      return null;
    }

    // -------------------------------------------------------
    // IMAGE
    // -------------------------------------------------------

    const imageValue =
      record["Image"] ||
      record["image"] ||
      null;

    const imageSource =
      getImageSource(imageValue);

    // -------------------------------------------------------
    // FRONTEND MAPPED FIELDS
    // -------------------------------------------------------
    //
    // IMPORTANT:
    //
    // These are the names produced by FrontendMapper.
    //
    // Frontend does NOT convert:
    //
    // fenner -> Part Number
    //
    // itself.
    //
    // Backend FrontendMapper already does that.
    //
    // -------------------------------------------------------

    const displayFields = [
      "Part Number",
      "Engine",
      "OEM",
      "Model",
      "Year",
      "ProductType",
      "Competitor PartNo",
      "Category",
      "GatesPartNumber",
      "Status",
      "Routing Guide",
    ];

    // -------------------------------------------------------
    // ONLY SHOW FIELDS WHICH HAVE VALUES
    // -------------------------------------------------------

    const fields = displayFields.filter(
      (fieldName) =>
        record[fieldName] !== null &&
        record[fieldName] !== undefined &&
        String(record[fieldName]).trim() !== ""
    );

    return (
      <div
        className="product-details-card"
        key={index}
      >

        {/* =================================================
            CARD HEADER
        ================================================= */}

        <div className="product-card-header">

          <div className="product-card-icon">
            📦
          </div>

          <div>
            
            <div className="product-card-title">
              {language === "fr" ? fr.productDetails : "Product Details"}
            </div>

            <div className="product-card-subtitle">
              {language === "fr"
                ? fr.matchingCatalogProducts
                : "Matching Catalog Product"}
            </div>

          </div>

        </div>

        {/* =================================================
            PRODUCT IMAGE
        ================================================= */}

        {imageSource && (
          <div className="product-image-container">

            <img
              src={imageSource}
              alt="Product"
              className="product-image"
              onError={(event) => {
                event.currentTarget.style.display =
                  "none";
              }}
            />

          </div>
        )}

        {/* =================================================
            PRODUCT FIELDS
        ================================================= */}

        <div className="product-card-fields">

          {fields.map(
            (fieldName) => (

              <div
                className="product-field-row"
                key={fieldName}
              >

                <div className="product-field-label">
                  {language === "fr"
                    ? fr.fields[fieldName] || fieldName
                    : fieldName}
                </div>

                <div className="product-field-value">
                  {fieldName === "Engine" && language === "fr"
                    ? engineLabels?.[String(record[fieldName]).trim()] ||
                      optionLabels?.[String(record[fieldName]).trim()] ||
                      String(record[fieldName])
                    : String(record[fieldName])}
                </div>

              </div>

            )
          )}

        </div>

        {/* DEALER AND ENQUIRY BUTTONS */}
        <div className="product-action-buttons">

          <button
            type="button"
            onClick={openDealerPage}
          >
            {dealerLabel}
          </button>

          <button
            type="button"
            onClick={openEnquiryPage}
          >
            {enquiryLabel}
          </button>

        </div>

      </div>
    );
  };
    
  // =========================================================
  // PRODUCT DETAILS TABLE
  // =========================================================

  const ProductDetailsTable = ({
    records,
    engineLabels,
  }) => {

    if (
      !Array.isArray(records) ||
      records.length === 0
    ) {
      return null;
    }

    const displayFields = [
      "Part Number",
      "Engine",
      "OEM",
      "Model",
      "Year",
      "ProductType",
      "Competitor PartNo",
      "Category",
      "GatesPartNumber",
      "Status",
      "Routing Guide",
    ];

    // -------------------------------------------------------
    // Only keep columns which contain at least one value.
    // -------------------------------------------------------

    const fields = displayFields.filter(
      (fieldName) =>
        records.some(
          (record) =>
            record &&
            record[fieldName] !== null &&
            record[fieldName] !== undefined &&
            String(
              record[fieldName]
            ).trim() !== ""
        )
    );

    if (fields.length === 0) {
      return null;
    }

    return (
      <div className="product-table-container">

        <div className="product-table-header">
      
          <div className="product-table-title">
            {language === "fr" ? fr.productDetails : "Product Details"}
          </div>

          <div className="product-table-subtitle">
            {language === "fr"
              ? fr.matchingCatalogProducts
              : "Matching Catalog Products"}
          </div>
        </div>

        <div className="product-table-wrapper">

          <table className="product-details-table">

            <thead>
              <tr>
                {fields.map(
                  (fieldName) => (
                    <th key={fieldName}>
                      {language === "fr"
                        ? fr.fields[fieldName] || fieldName
                        : fieldName}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>

              {records.map(
                (record, recordIndex) => (

                  <tr
                    key={recordIndex}
                  >

                    {fields.map(
                      (fieldName) => (

                        <td key={fieldName}>
                          {record[fieldName] !== null &&
                          record[fieldName] !== undefined &&
                          String(record[fieldName]).trim() !== ""
                            ? fieldName === "Engine" && language === "fr"
                              ? engineLabels?.[String(record[fieldName]).trim()] ||
                                String(record[fieldName])
                              : String(record[fieldName])
                            : "—"}
                        </td>

                      )
                    )}

                  </tr>

                )
              )}

            </tbody>

          </table>

        </div>
        {/* DEALER AND ENQUIRY BUTTONS */}
        <div className="product-action-buttons">

          <button
            type="button"
            onClick={openDealerPage}
          >
            {dealerLabel}
          </button>

          <button
            type="button"
            onClick={openEnquiryPage}
          >
            {enquiryLabel}
          </button>

        </div>

      </div>
    );
  };
  // =========================================================
  // CHAT CLOSED
  if (!isChatOpen) {
    return (
      <div className="app-container chat-closed-screen">
        <button className="ai-chat-open-button" onClick={openChat} type="button">
          AI Chat
        </button>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="chat-window">
        <aside className="chat-sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-logo">
              <img src="/company-logo.png" alt="JK Fenner Logo" />
            </div>
            <div>
              <div className="sidebar-brand-title">AI Assistant</div>
              <div className="sidebar-brand-subtitle">JK Fenner Product Catalog</div>
            </div>
          </div>

          <button className="new-chat-button" onClick={startNewChat} disabled={isLoading} type="button">
            <span className="sidebar-action-icon">＋</span>
            {language === "fr" ? "Nouvelle discussion" : "New Chat"}
          </button>

          <div className="sidebar-section-heading">
            <span>{language === "fr" ? "Historique" : "Chat History"}</span>
            <span className="history-count">{chatHistory.length}</span>
          </div>

          <div className="chat-history-list">
            {chatHistory.length === 0 ? (
              <div className="empty-history">
                {language === "fr" ? "Vos conversations apparaîtront ici." : "Your previous conversations will appear here."}
              </div>
            ) : chatHistory.map((session) => (
              <button
                key={session.id}
                type="button"
                className={`history-item ${session.id === conversationId ? "active" : ""}`}
                onClick={() => openHistoryChat(session)}
                disabled={isLoading}
                title={session.title}
              >
                <span className="history-item-icon">◷</span>
                <span className="history-item-title">{session.title || "New conversation"}</span>
              </button>
            ))}
          </div>

          <div className="sidebar-footer">
            <span className="sidebar-status-dot" />
            <span>AI Product Catalog</span>
          </div>
        </aside>

        <main className="chat-main">
          <header className="chat-header">
            <div className="header-left">
              <div className="header-text">
                <div className="header-title">AI Product Catalog</div>
                <div className="header-subtitle">
                  {language === "fr" ? "Assistant produit" : "Product Assistant"}
                </div>
              </div>
            </div>

            <div className="header-actions">
              <div className="language-selector">
                <button
                  className="language-trigger"
                  type="button"
                  title="Select language"
                  onClick={() => setShowLanguageMenu((previous) => !previous)}
                  aria-expanded={showLanguageMenu}
                >
                  <span className="globe-icon">◎</span>
                  <span className="selected-language">{language === "fr" ? "Français" : "English"}</span>
                  <span className="dropdown-chevron">⌄</span>
                </button>

                {showLanguageMenu && (
                  <div className="language-dropdown">
                    <button
                      type="button"
                      className={language === "en" ? "selected" : ""}
                      onClick={() => { setLanguage("en"); setShowLanguageMenu(false); }}
                    >
                      🇬🇧 English {language === "en" && <span className="language-check">✓</span>}
                    </button>
                    <button
                      type="button"
                      className={language === "fr" ? "selected" : ""}
                      onClick={() => { setLanguage("fr"); setShowLanguageMenu(false); }}
                    >
                      🇫🇷 Français {language === "fr" && <span className="language-check">✓</span>}
                    </button>
                  </div>
                )}
              </div>

              <button className="header-icon-button" title="Reset conversation" onClick={resetChat} disabled={isLoading} type="button" aria-label="Reset conversation">↻</button>
              <button className="header-icon-button close-chat-button" title="Close" onClick={closeChat} type="button" aria-label="Close chat">×</button>
            </div>
          </header>

          <section className="chat-messages">
            {messages.length === 0 && !isLoading && (
              <div className="welcome-container">
                <div className="welcome-icon">✦</div>
                <div className="welcome-eyebrow">
                  {language === "fr" ? "ASSISTANT DE CATALOGUE INTELLIGENT" : "AI-POWERED PRODUCT DISCOVERY"}
                </div>
                <h2>{language === "fr" ? "Bienvenue !" : "Welcome!"}</h2>
                <p>
                  {language === "fr"
                    ? "Que recherchez-vous aujourd'hui ? Trouvez rapidement le bon produit."
                    : "What are you looking for today? Find the right product from our catalog."}
                </p>

                <div className="suggestion-section">
                  <div className="suggestion-heading">{language === "fr" ? "Essayez une recherche" : "Try searching"}</div>
                  <div className="suggestion-grid">
                    <button className="suggestion-card" type="button" onClick={() => setMessage("6PK220")} disabled={isLoading}>
                      <span className="suggestion-icon">#</span>
                      <span className="suggestion-copy">
                        <strong>{language === "fr" ? "Rechercher par référence" : "Search by Part Number"}</strong>
                        <small>6PK220</small>
                      </span>
                      <span className="suggestion-arrow">↗</span>
                    </button>
                    <button className="suggestion-card" type="button" onClick={() => setMessage("Give me details for Ford")} disabled={isLoading}>
                      <span className="suggestion-icon">⌕</span>
                      <span className="suggestion-copy">
                        <strong>{language === "fr" ? "Rechercher par OEM" : "Search by OEM"}</strong>
                        <small>Give me details for Ford</small>
                      </span>
                      <span className="suggestion-arrow">↗</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {messages.map((chatMessage) => (
              <div
                key={chatMessage.id}
                className={chatMessage.sender === "user" ? "message-row user-row" : "message-row ai-row"}
              >
                <div className="message-content">
                  <div className={chatMessage.sender === "user" ? "message-bubble user-bubble" : "message-bubble ai-bubble"}>
                    <div className="message-text">{chatMessage.text}</div>

                    {chatMessage.sender === "ai" && (
                      <div className="message-speech-control">
                        <button
                          type="button"
                          className={`speaker-button ${speakingMessageId === chatMessage.id ? "speaking" : ""}`}
                          onClick={() => speakMessage(chatMessage)}
                          title={speakingMessageId === chatMessage.id ? "Stop voice" : playedMessageIds.has(chatMessage.id) ? "Replay voice" : "Play voice"}
                          aria-label={speakingMessageId === chatMessage.id ? "Stop voice response" : "Play voice response"}
                        >
                          {speakingMessageId === chatMessage.id ? "🔊" : "🔈"}
                        </button>
                        {playedMessageIds.has(chatMessage.id) && speakingMessageId !== chatMessage.id && (
                          <span className="replay-icon" title="Replay voice">↻</span>
                        )}
                      </div>
                    )}

                    {chatMessage.sender === "ai" && Array.isArray(chatMessage.options) && chatMessage.options.length > 0 && (
                      <div className="chat-options">
                        {chatMessage.options.map((option, optionIndex) => (
                          <button
                            key={`${chatMessage.id}-${optionIndex}`}
                            className="chat-option-button"
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleOptionClick(option, chatMessage.optionLabels || {})}
                          >
                            {chatMessage.optionLabels?.[String(option).trim()] || getOptionDisplayLabel(option, language)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {chatMessage.sender === "ai" && chatMessage.presentationFormat === "card" &&
                    Array.isArray(chatMessage.frontendRecords) && chatMessage.frontendRecords.length > 0 && (
                      <div className="product-results-container">
                        {chatMessage.frontendRecords.map((record, recordIndex) => (
                          <ProductDetailsCard
                            key={`${chatMessage.id}-product-${recordIndex}`}
                            record={record}
                            index={recordIndex}
                            optionLabels={chatMessage.optionLabels || {}}
                            engineLabels={chatMessage.engineLabels || {}}
                          />
                        ))}
                      </div>
                    )}

                  {chatMessage.sender === "ai" && chatMessage.presentationFormat === "table" &&
                    Array.isArray(chatMessage.frontendRecords) && chatMessage.frontendRecords.length > 0 && (
                      <ProductDetailsTable
                        records={chatMessage.frontendRecords}
                        engineLabels={chatMessage.engineLabels || {}}
                      />
                    )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="message-row ai-row">
                <div className="message-bubble ai-bubble loading-bubble">
                  <span className="loading-dots"><i /><i /><i /></span>
                  {language === "fr" ? "Réflexion en cours..." : "Thinking..."}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </section>

          <footer className="chat-input-area">
            <div className="input-wrapper">
              <button
                className={isRecording ? "mic-button recording" : isVoiceProcessing ? "mic-button voice-processing" : "mic-button"}
                title={isRecording ? "Stop recording" : isVoiceProcessing ? "Converting voice to text..." : "Voice input"}
                type="button"
                disabled={isLoading || isVoiceProcessing}
                onClick={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? "⏹" : isVoiceProcessing ? <span className="voice-search-loader" /> : "🎙"}
              </button>

              <input
                type="text"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={language === "fr" ? "Saisissez votre message..." : "Ask about a part number, OEM, model..."}
                disabled={isLoading}
              />

              <button className="send-button" onClick={() => sendMessage()} title="Send" type="button" disabled={isLoading || !message.trim()}>
                ➤
              </button>
            </div>
            <div className="composer-hint">
              {language === "fr" ? "Appuyez sur Entrée pour envoyer" : "Press Enter to send"}
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default App;