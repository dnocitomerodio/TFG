import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const GoogleLogo = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M17.64 9.204c0-.638-.057-1.251-.164-1.84H9v3.48h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      fill="#4285F4"
    />
    <path
      d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.716H.957v2.332A8.997 8.997 0 0 0 9 18z"
      fill="#34A853"
    />
    <path
      d="M3.964 10.71A5.41 5.41 0 0 1 3.64 9c0-.61.104-1.2.304-1.71V4.957H.957A8.996 8.996 0 0 0 0 9c0 1.614.394 3.136 1.085 4.43l2.879-2.72z"
      fill="#FBBC05"
    />
    <path
      d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.582C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.957l2.879 2.72C4.544 5.544 6.528 3.58 9 3.58z"
      fill="#EA4335"
    />
  </svg>
);

const Register = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let intervalId;
    if (isPolling && formData.email) {
      intervalId = setInterval(async () => {
        try {
          const { data } = await axios.post(
            "http://localhost:5000/api/auth/check-verified",
            {
              email: formData.email,
            }
          );
          if (data.verified) {
            setIsPolling(false);
            setMessage("Email verified successfully! Redirecting to home...");
            setTimeout(() => navigate("/"), 2000);
          }
        } catch (error) {
          console.error("Verification check error:", error);
          setMessage("Error checking verification status. Please try again.");
        }
      }, 5000);
    }
    return () => clearInterval(intervalId);
  }, [isPolling, formData.email, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    if (formData.password.length < 8) {
      setMessage("Password must be at least 8 characters long.");
      return;
    }
    setIsLoading(true);
    try {
      // eslint-disable-next-line no-unused-vars
      const { data } = await axios.post(
        "http://localhost:5000/api/auth/register",
        formData
      );
      setMessage(
        `Registration successful! Please check your email (${formData.email}) to verify your account. Check your spam/junk folder if you don't see the email.`
      );
      setIsSuccess(true);
      setIsPolling(true);
      setFormData({ email: formData.email, password: "" });
      setRetryCount(0);
    } catch (error) {
      console.error("Registration error:", error);
      if (error.code === "ERR_NETWORK") {
        setMessage(
          `Unable to connect to the server. Retry attempt ${retryCount + 1}.`
        );
        setRetryCount(retryCount + 1);
      } else {
        setMessage(
          error.response?.data?.msg || "An error occurred during registration."
        );
      }
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    setIsLoading(true);
    window.location.href = "http://localhost:5000/api/auth/google";
  };

  const handleResendVerification = async () => {
    setIsLoading(true);
    setMessage("");
    try {
      const { data } = await axios.post(
        "http://localhost:5000/api/auth/resend-verification",
        {
          email: formData.email,
        }
      );
      setMessage(
        data.msg || "Verification email resent successfully. Check your email."
      );
    } catch (error) {
      console.error("Resend verification error:", error);
      if (error.code === "ERR_NETWORK") {
        setMessage(
          `Unable to connect to the server. Retry attempt ${retryCount + 1}.`
        );
        setRetryCount(retryCount + 1);
      } else {
        setMessage(
          error.response?.data?.msg || "Failed to resend verification email."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    if (!isSuccess) {
      handleSubmit({ preventDefault: () => {} });
    } else {
      handleResendVerification();
    }
  };

  if (isSuccess) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
        <div className="card shadow p-4" style={{ width: "400px" }}>
          <h2 className="text-center mb-4">Verify Your Email</h2>
          <div className="alert alert-info text-center" role="alert">
            <i className="bi bi-envelope-fill me-2"></i>
            Please check your email ({formData.email}) to verify your account.
            Check your spam/junk folder if you don’t see the email.
          </div>
          {message && (
            <div
              className={`alert ${
                message.includes("Failed") || message.includes("Unable")
                  ? "alert-danger"
                  : "alert-success"
              } mt-3`}
              role="alert"
            >
              {message}
              {message.includes("Unable") && retryCount < 3 && (
                <button
                  onClick={handleRetry}
                  className="btn btn-link p-0 ms-2"
                  style={{ textDecoration: "none" }}
                >
                  Retry
                </button>
              )}
            </div>
          )}
          <button
            onClick={handleResendVerification}
            className="btn btn-primary w-100"
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Resend Verification Email"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="card shadow p-4" style={{ width: "400px" }}>
        <h2 className="text-center mb-4">Register</h2>
        {message && (
          <div
            className={`alert ${
              message.includes("error") ||
              message.includes("Failed") ||
              message.includes("Unable")
                ? "alert-danger"
                : "alert-success"
            } mt-3`}
            role="alert"
          >
            {message}
            {message.includes("Unable") && retryCount < 3 && (
              <button
                onClick={handleRetry}
                className="btn btn-link p-0 ms-2"
                style={{ textDecoration: "none" }}
              >
                Retry
              </button>
            )}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className="form-control"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>
          <div className="mb-3">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className="form-control"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            className="btn btn-success w-100 mb-2"
            disabled={isLoading}
          >
            {isLoading ? "Registering..." : "Register"}
          </button>
          <button
            type="button"
            onClick={handleGoogleSignUp}
            className="btn w-100 mb-2 d-flex align-items-center justify-content-center"
            style={{
              backgroundColor: "#fff",
              border: "1px solid #dadce0",
              borderRadius: "4px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              color: "#3c4043",
              fontWeight: 500,
              padding: "10px",
              transition: "box-shadow 0.2s, background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
              e.target.style.backgroundColor = "#f8f9fa";
            }}
            onMouseLeave={(e) => {
              e.target.style.boxShadow = "0 1px 2px rgba(0,0,0,0.1)";
              e.target.style.backgroundColor = "#fff";
            }}
            disabled={isLoading}
            aria-label="Sign up with Google"
          >
            <GoogleLogo />
            <span className="ms-2">
              {isLoading ? "Processing..." : "Sign up with Google"}
            </span>
          </button>
        </form>
        <div className="text-center mt-3">
          <a href="/login" className="text-decoration-none">
            Already have an account? Login here
          </a>
        </div>
      </div>
    </div>
  );
};

export default Register;
