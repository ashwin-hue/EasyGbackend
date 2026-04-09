import { useEffect, useMemo, useState } from "react";
import "./Login.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const sexLabels = {
  "1": "Male",
  "0": "Female",
};

const yesNoLabels = {
  "1": "Yes",
  "0": "No",
};

const chestPainLabels = {
  "1": "Typical angina",
  "2": "Atypical angina",
  "3": "Non-anginal pain",
  "4": "No chest pain",
};

const thalassemiaLabels = {
  "1": "Normal",
  "2": "Fixed defect",
  "3": "Reversible defect",
};

const signupQuestions = [
  {
    id: "age",
    question: "How old are you?",
    description: "Your age in years.",
    type: "number",
    placeholder: "Enter your age",
    min: 18,
    max: 120,
  },
  {
    id: "sex",
    question: "What is your gender?",
    description: "Select your biological sex.",
    type: "radio",
    options: [
      { value: "1", label: "Male" },
      { value: "0", label: "Female" },
    ],
  },
  {
    id: "resting_blood_pressure",
    question: "What is your resting blood pressure?",
    description: "Use the systolic reading in mmHg.",
    type: "number",
    placeholder: "Example: 120",
    min: 60,
    max: 220,
  },
  {
    id: "serum_cholesterol",
    question: "What is your total cholesterol level?",
    description: "Enter the value in mg/dL.",
    type: "number",
    placeholder: "Example: 180",
    min: 100,
    max: 400,
  },
  {
    id: "fasting_blood_sugar",
    question: "Is your fasting blood sugar above 120 mg/dL?",
    description: "Measured after fasting for 8+ hours.",
    type: "radio",
    options: [
      { value: "0", label: "No" },
      { value: "1", label: "Yes" },
    ],
  },
  {
    id: "chest_pain_type",
    question: "Which chest pain type fits you best?",
    description: "Choose the closest description.",
    type: "select",
    options: [
      { value: "1", label: "Typical angina" },
      { value: "2", label: "Atypical angina" },
      { value: "3", label: "Non-anginal pain" },
      { value: "4", label: "No chest pain" },
    ],
  },
  {
    id: "exercise_induced_angina",
    question: "Do you feel chest discomfort during exercise?",
    description: "Choose yes if it happens with physical activity.",
    type: "radio",
    options: [
      { value: "0", label: "No" },
      { value: "1", label: "Yes" },
    ],
  },
  {
    id: "smoking_status",
    question: "Do you smoke or have you smoked recently?",
    description: "Share your current or recent smoking status.",
    type: "radio",
    options: [
      { value: "0", label: "No" },
      { value: "1", label: "Yes" },
    ],
  },
  {
    id: "diabetes",
    question: "Do you have diabetes?",
    description: "Tell us if you are diagnosed with diabetes.",
    type: "radio",
    options: [
      { value: "0", label: "No" },
      { value: "1", label: "Yes" },
    ],
  },
  {
    id: "number_of_major_vessels",
    question: "How many major vessels show narrowing?",
    description: "If known from previous medical testing.",
    type: "select",
    options: [
      { value: "0", label: "0 vessels" },
      { value: "1", label: "1 vessel" },
      { value: "2", label: "2 vessels" },
      { value: "3", label: "3 vessels" },
    ],
  },
  {
    id: "thalassemia",
    question: "What is your thalassemia status?",
    description: "Choose the available medical classification.",
    type: "select",
    options: [
      { value: "1", label: "Normal" },
      { value: "2", label: "Fixed defect" },
      { value: "3", label: "Reversible defect" },
    ],
  },
];

const initialSignupData = {
  username: "",
  password: "",
  age: "",
  sex: "",
  resting_blood_pressure: "",
  serum_cholesterol: "",
  fasting_blood_sugar: "",
  exercise_induced_angina: "",
  number_of_major_vessels: "",
  thalassemia: "",
  chest_pain_type: "",
  smoking_status: "",
  diabetes: "",
};

const initialLoginData = {
  username: "",
  password: "",
};

function renderField(question, value, onChange) {
  if (question.type === "number") {
    return (
      <input
        type="number"
        name={question.id}
        value={value}
        onChange={onChange}
        placeholder={question.placeholder}
        min={question.min}
        max={question.max}
        className="auth-input"
      />
    );
  }

  if (question.type === "radio") {
    return (
      <div className="choice-grid">
        {question.options.map((option) => (
          <label key={option.value} className="choice-card">
            <input
              type="radio"
              name={question.id}
              value={option.value}
              checked={value === option.value}
              onChange={onChange}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <select
      name={question.id}
      value={value}
      onChange={onChange}
      className="auth-input"
    >
      <option value="">Select an option</option>
      {question.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function Login({ onAuth }) {
  const [activePanel, setActivePanel] = useState("signup");
  const [signupStep, setSignupStep] = useState(0);
  const [loginData, setLoginData] = useState(initialLoginData);
  const [signupData, setSignupData] = useState(initialSignupData);
  const [currentUser, setCurrentUser] = useState(null);
  const [submittedMode, setSubmittedMode] = useState("");
  const [loginStatus, setLoginStatus] = useState("");
  const [signupStatus, setSignupStatus] = useState("");
  const [loginError, setLoginError] = useState("");
  const [signupError, setSignupError] = useState("");
  const [usernameStatus, setUsernameStatus] = useState("");
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);

  const signupSteps = useMemo(
    () => [
      {
        id: "credentials",
        title: "Create your secure account",
        description: "Start with the credentials you will use to sign in.",
        fields: [
          {
            id: "username",
            question: "Choose a username",
            description: "This will identify the user account.",
            type: "text",
            placeholder: "Enter username",
          },
          {
            id: "password",
            question: "Create a password",
            description: "Use a strong password for your account.",
            type: "password",
            placeholder: "Enter password",
          },
        ],
      },
      ...signupQuestions.map((question) => ({
        id: question.id,
        title: question.question,
        description: question.description,
        fields: [question],
      })),
    ],
    []
  );

  const currentSignupStep = signupSteps[signupStep];
  const signupProgress = ((signupStep + 1) / signupSteps.length) * 100;

  const submitJson = async (path, payload) => {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();

      if (!contentType.includes("application/json")) {
        if (response.status === 404) {
          throw new Error(
            "API route not found. Make sure the Node backend is running on port 5000."
          );
        }

        if (text.trim().startsWith("<")) {
          throw new Error(
            "Received HTML instead of API data. Start the backend server and use `npm run dev` for the frontend."
          );
        }

        throw new Error("The backend did not return JSON.");
      }

      const data = text ? JSON.parse(text) : {};

      if (!response.ok) {
        throw new Error(data.message || "Request failed.");
      }

      return data;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("The backend returned malformed JSON.");
      }

      if (error instanceof TypeError) {
        throw new Error("Cannot reach the backend server. Start the Node server and try again.");
      }

      throw error;
    }
  };

  const handleLoginChange = (event) => {
    const { name, value } = event.target;
    setLoginError("");
    setLoginStatus("");
    setLoginData((current) => ({ ...current, [name]: value }));
  };

  const handleSignupChange = (event) => {
    const { name, value } = event.target;
    setSignupError("");
    setSignupStatus("");
    if (name === "username") {
      setUsernameStatus("");
      setIsUsernameAvailable(true);
    }
    setSignupData((current) => ({ ...current, [name]: value }));
  };

  useEffect(() => {
    const trimmedUsername = signupData.username.trim();

    if (!trimmedUsername) {
      setUsernameStatus("");
      setIsUsernameAvailable(true);
      setIsCheckingUsername(false);
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsCheckingUsername(true);

        const response = await fetch(
          `${API_BASE_URL}/api/check-username?username=${encodeURIComponent(trimmedUsername)}`,
          { signal: controller.signal }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to check username.");
        }

        setIsUsernameAvailable(Boolean(data.available));
        setUsernameStatus(data.message || "");
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        setIsUsernameAvailable(true);
        setUsernameStatus("");
      } finally {
        setIsCheckingUsername(false);
      }
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [signupData.username]);

  const currentStepIsComplete = currentSignupStep.fields.every(
    (field) => signupData[field.id].trim() !== ""
  );
  const isCredentialsStep = currentSignupStep.id === "credentials";
  const canProceedSignupStep =
    currentStepIsComplete &&
    (!isCredentialsStep || (isUsernameAvailable && !isCheckingUsername));

  const handleSignupNext = async () => {
    if (!currentStepIsComplete) {
      return;
    }

    if (signupStep === signupSteps.length - 1) {
      try {
        setIsSigningUp(true);
        setSignupError("");

        const payload = await submitJson("/api/signup", signupData);

        setCurrentUser(payload.user || null);
        setSubmittedMode("signup");
        setSignupStatus(payload.message || "Account created successfully.");
        onAuth?.(payload.user || null);
      } catch (error) {
        setSignupError(error.message);
      } finally {
        setIsSigningUp(false);
      }
      return;
    }

    setSignupStep((step) => step + 1);
  };

  const handleSignupPrevious = () => {
    if (signupStep > 0) {
      setSignupStep((step) => step - 1);
    }
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    if (!loginData.username.trim() || !loginData.password.trim()) {
      return;
    }

    try {
      setIsLoggingIn(true);
      setLoginError("");

      const payload = await submitJson("/api/login", loginData);

      setCurrentUser(payload.user || null);
      setSubmittedMode("login");
      setLoginStatus(payload.message || "Login successful.");
      onAuth?.(payload.user || null);
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSubmittedMode("");
    setLoginStatus("");
    setSignupStatus("");
    setLoginError("");
    setSignupError("");
    setActivePanel("login");
  };

  const userHighlights = currentUser
    ? [
        { label: "Age", value: `${currentUser.age} years` },
        { label: "Sex", value: sexLabels[currentUser.sex] || currentUser.sex },
        {
          label: "Blood pressure",
          value: `${currentUser.resting_blood_pressure} mmHg`,
        },
        {
          label: "Cholesterol",
          value: `${currentUser.serum_cholesterol} mg/dL`,
        },
      ]
    : [];

  const healthNotes = currentUser
    ? [
        {
          label: "Fasting blood sugar",
          value:
            yesNoLabels[currentUser.fasting_blood_sugar] ||
            currentUser.fasting_blood_sugar,
        },
        {
          label: "Exercise angina",
          value:
            yesNoLabels[currentUser.exercise_induced_angina] ||
            currentUser.exercise_induced_angina,
        },
        {
          label: "Smoking",
          value:
            yesNoLabels[currentUser.smoking_status] || currentUser.smoking_status,
        },
        {
          label: "Diabetes",
          value: yesNoLabels[currentUser.diabetes] || currentUser.diabetes,
        },
        {
          label: "Chest pain type",
          value:
            chestPainLabels[currentUser.chest_pain_type] ||
            currentUser.chest_pain_type,
        },
        {
          label: "Thalassemia",
          value:
            thalassemiaLabels[currentUser.thalassemia] || currentUser.thalassemia,
        },
      ]
    : [];

  return (
    <main className="landing-shell">
      <div className="ambient-bubbles" aria-hidden="true">
        <span className="bubble bubble-1" />
        <span className="bubble bubble-2" />
        <span className="bubble bubble-3" />
        <span className="bubble bubble-4" />
        <span className="bubble bubble-5" />
        <span className="bubble bubble-6" />
      </div>

      <section className="hero-panel">
        <nav className="topbar">
          <div className="brand">
            <span className="brand-mark">easyG</span>
            <span className="brand-sub">Cardiac intelligence platform</span>
          </div>
        </nav>

        <div className="hero-copy">
          <p className="eyebrow">BUILT FOR SMART HEART MONITORING & EARLY RISK DETECTION</p>
          <h1>A smarter gateway to continuous health monitoring and predictive care.</h1>
          <p className="hero-text">
          Empower users with continuous heart data tracking, seamless onboarding, and AI-driven risk analysis—without overwhelming them with complex medical interfaces.
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="primary-cta"
              onClick={() => setActivePanel("signup")}
            >
              Start monitoring
            </button>
            <button
              type="button"
              className="secondary-cta"
              onClick={() => setActivePanel("login")}
            >
              Member login
            </button>
          </div>
        </div>

        <div className="hero-metrics">
          <article>
            <strong>Real-time ECG</strong>
            <span>Capture and stream ECG signals directly from IoT devices with instant data availability.</span>
          </article>
          <article>
            <strong>Secure access</strong>
            <span>Quick and safe login for returning users with encrypted health data protection.</span>
          </article>
          <article>
            <strong>AI risk analysis</strong>
            <span>Machine learning models analyze ECG patterns to detect early signs of cardiac risk.</span>
          </article>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          {currentUser ? (
            <div className="auth-form welcome-panel">
              <div className="auth-heading">
                <p className="panel-kicker">Welcome back</p>
                <h2>Hi, {currentUser.username}</h2>
                <p>
                  Your account is ready. Here is a quick look at your basic profile
                  and health details.
                </p>
              </div>

              <div className="welcome-banner">
                <strong>{currentUser.username}</strong>
                <span>
                  {currentUser.age} years old {" "}
                  {sexLabels[currentUser.sex] || currentUser.sex}
                </span>
              </div>

              <div className="stats-grid">
                {userHighlights.map((item) => (
                  <article key={item.label} className="stat-card">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>

              <div className="detail-list">
                {healthNotes.map((item) => (
                  <div key={item.label} className="detail-row">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>

              <button type="button" className="secondary-cta" onClick={handleLogout}>
                Log out
              </button>
            </div>
          ) : (
            <>
              <div className="auth-tabs">
                <button
                  type="button"
                  className={`auth-tab ${activePanel === "signup" ? "active" : ""}`}
                  onClick={() => setActivePanel("signup")}
                >
                  Sign up
                </button>
                <button
                  type="button"
                  className={`auth-tab ${activePanel === "login" ? "active" : ""}`}
                  onClick={() => setActivePanel("login")}
                >
                  Log in
                </button>
              </div>

              {activePanel === "login" ? (
                <form className="auth-form" onSubmit={handleLoginSubmit}>
                  <div className="auth-heading">
                    <p className="panel-kicker">Secure member access</p>
                    <h2>Log in to your account</h2>
                    <p>Enter your username and password to continue.</p>
                  </div>

                  <label className="field-block">
                    <span>Username</span>
                    <input
                      type="text"
                      name="username"
                      value={loginData.username}
                      onChange={handleLoginChange}
                      className="auth-input"
                      placeholder="Enter username"
                    />
                  </label>

                  <label className="field-block">
                    <span>Password</span>
                    <input
                      type="password"
                      name="password"
                      value={loginData.password}
                      onChange={handleLoginChange}
                      className="auth-input"
                      placeholder="Enter password"
                    />
                  </label>

                  <button
                    type="submit"
                    className="submit-button"
                    disabled={
                      isLoggingIn ||
                      !loginData.username.trim() ||
                      !loginData.password.trim()
                    }
                  >
                    {isLoggingIn ? "Logging in..." : "Log in"}
                  </button>

                  {loginError ? <p className="error-note">{loginError}</p> : null}
                  {submittedMode === "login" ? (
                    <p className="status-note">{loginStatus}</p>
                  ) : null}
                </form>
              ) : (
                <div className="auth-form">
                  <div className="auth-heading">
                    <p className="panel-kicker">Premium onboarding</p>
                    <h2>{currentSignupStep.title}</h2>
                    <p>{currentSignupStep.description}</p>
                  </div>

                  <div className="progress-rail">
                    <div className="progress-meta">
                      <span>
                        Step {signupStep + 1} of {signupSteps.length}
                      </span>
                      <span>{Math.round(signupProgress)}%</span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${signupProgress}%` }}
                      />
                    </div>
                  </div>

                  <div className="question-stack">
                    {currentSignupStep.fields.map((field) => (
                      <div key={field.id} className="field-block">
                        <span>{field.question}</span>
                        {field.type === "text" || field.type === "password" ? (
                          <>
                            <input
                              type={field.type}
                              name={field.id}
                              value={signupData[field.id]}
                              onChange={handleSignupChange}
                              className="auth-input"
                              placeholder={field.placeholder}
                            />
                            {field.id === "username" && usernameStatus ? (
                              <p
                                className={
                                  isUsernameAvailable ? "status-note" : "error-note"
                                }
                              >
                                {usernameStatus}
                              </p>
                            ) : null}
                            {field.id === "username" &&
                            isCheckingUsername &&
                            signupData.username.trim() ? (
                              <p className="status-note">Checking username...</p>
                            ) : null}
                          </>
                        ) : (
                          renderField(field, signupData[field.id], handleSignupChange)
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="form-nav">
                    <button
                      type="button"
                      className="nav-button muted"
                      onClick={handleSignupPrevious}
                      disabled={signupStep === 0}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="nav-button"
                      onClick={handleSignupNext}
                      disabled={!canProceedSignupStep || isSigningUp}
                    >
                      {signupStep === signupSteps.length - 1
                        ? isSigningUp
                          ? "Creating account..."
                          : "Create account"
                        : "Next"}
                    </button>
                  </div>

                  <div className="step-dots">
                    {signupSteps.map((step, index) => (
                      <button
                        key={step.id}
                        type="button"
                        className={`step-dot ${index === signupStep ? "active" : ""}`}
                        onClick={() => index <= signupStep && setSignupStep(index)}
                        aria-label={`Go to step ${index + 1}`}
                      />
                    ))}
                  </div>

                  {signupError ? <p className="error-note">{signupError}</p> : null}
                  {submittedMode === "signup" ? (
                    <p className="status-note">{signupStatus}</p>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

export default Login;
