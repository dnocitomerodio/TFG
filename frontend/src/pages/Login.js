import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

const Login = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

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

          const response = await axios.post(
            "http://localhost:5000/auth/refresh",
            {},
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("refreshToken")}`,
              },
            }
          );

          if (response.status === 200) {
            localStorage.setItem("token", response.data.access_token);
            setIsAuthenticated(true);
            setMessage(`Welcome back, ${email}!`);
          }
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
    setIsLoading(true);
    try {
      const response = await axios.post(
        "http://localhost:5000/auth/login",
        formData
      );
      console.log("Login response:", response.data);

      if (!response.data.access_token || !response.data.refresh_token) {
        throw new Error("Invalid login response: Missing tokens");
      }

      localStorage.setItem("token", response.data.access_token);
      localStorage.setItem("refreshToken", response.data.refresh_token);

      const decoded = jwtDecode(response.data.access_token);
      console.log("Decoded login token:", decoded);
      const email = decoded.identity || decoded.sub;

      setMessage(`Welcome, ${email}!`);
      setIsAuthenticated(true);
      navigate("/");
    } catch (error) {
      console.error("Login error:", error);
      setMessage(
        error.response?.data?.msg || "An error occurred during login."
      );
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
    }
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
            className="btn btn-primary w-100"
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : "Sign in with Google"}
          </button>
        </form>
        {message && (
          <p
            className={`text-center mt-3 ${
              message.includes("error") || message.includes("Failed")
                ? "text-danger"
                : "text-success"
            }`}
          >
            {message}
          </p>
        )}
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
