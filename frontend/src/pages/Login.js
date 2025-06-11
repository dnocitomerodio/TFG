import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

// Google logo SVG (from Google's official branding guidelines)
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

const Login = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (message.includes("Unable") && retryCount < 3) {
      const timer = setTimeout(() => {
        handleRetry();
      }, 3000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, retryCount]);

  useEffect(() => {
    const verifyAuthentication = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          if (typeof token !== "string" || token.split(".").length !== 3) {
            throw new Error("Invalid token format");
          }

          const decoded = jwtDecode(token);
          const email = decoded.identity || decoded.sub;

          const { data } = await axios.post(
            "http://localhost:5000/auth/refresh",
            {},
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("refreshToken")}`,
              },
            }
          );

          localStorage.setItem("token", data.access_token);
          setIsAuthenticated(true);
          setMessage(`Welcome back, ${email}!`);
        } catch (error) {
          console.error("Token validation failed:", error.message);
          setIsAuthenticated(false);
          localStorage.removeItem("token");
          localStorage.removeItem("refreshToken");
          setMessage("Session expired. Please log in again.");
        }
      }
    };

    verifyAuthentication();
  }, []);

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
      const { data } = await axios.post(
        "http://localhost:5000/auth/login",
        formData
      );

      if (!data.access_token || !data.refresh_token) {
        throw new Error("Invalid login response: Missing tokens");
      }

      localStorage.setItem("token", data.access_token);
      localStorage.setItem("refreshToken", data.refresh_token);

      const decoded = jwtDecode(data.access_token);
      const email = decoded.identity || decoded.sub;

      setMessage(`Welcome, ${email}!`);
      setIsAuthenticated(true);
      setRetryCount(0);
      navigate("/");
    } catch (error) {
      console.error("Login error:", error);
      if (error.code === "ERR_NETWORK") {
        setMessage(
          `Unable to connect to the server. Retry attempt ${
            retryCount + 1
          } of 3.`
        );
        setRetryCount(retryCount + 1);
      } else {
        setMessage(
          error.response?.data?.msg || "An error occurred while logging in."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    window.location.href = "http://localhost:5000/auth/google";
  };

  const handleLogout = async () => {
    try {
      await axios.post(
        "http://localhost:5000/auth/logout",
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("refreshToken")}`,
          },
        }
      );
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      setIsAuthenticated(false);
      setMessage("");
      navigate("/login");
    }
  };

  const handleRetry = () => {
    handleSubmit({ preventDefault: () => {} });
  };

  if (isAuthenticated) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
        <div className="card shadow p-4" style={{ width: "400px" }}>
          <h2 className="text-center mb-4">You are logged in!</h2>
          <p className="text-center">{message}</p>
          <button onClick={handleLogout} className="btn btn-danger w-100">
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="card shadow p-4" style={{ width: "400px" }}>
        <h2 className="text-center mb-4">Login</h2>
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
                Retry Now
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
            {isLoading ? "Logging in..." : "Login"}
          </button>
          <button
            type="button"
            onClick={handleGoogleSignIn}
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
            aria-label="Sign in with Google"
          >
            <GoogleLogo />
            <span className="ms-2">
              {isLoading ? "Processing..." : "Sign in with Google"}
            </span>
          </button>
        </form>
        <div className="text-center mt-2">
          <a href="/forgot-password" className="text-decoration-none">
            Forgot your password?
          </a>
        </div>
        <div className="text-center mt-3">
          <a href="/register" className="text-decoration-none">
            Don't have an account? Register here
          </a>
        </div>
      </div>
    </div>
  );
};

export default Login;
