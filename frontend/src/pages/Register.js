import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const Register = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await axios.post(
        "http://localhost:5000/auth/register",
        formData
      );
      setMessage(response.data.msg);
      setFormData({ email: "", password: "" });
      setTimeout(() => navigate("/login"), 3000);
    } catch (error) {
      console.error("Registration error:", error);
      setMessage(
        error.response?.data?.msg || "An error occurred during registration."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    setIsLoading(true);
    window.location.href = "http://localhost:5000/auth/google";
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="card shadow p-4" style={{ width: "400px" }}>
        <h2 className="text-center mb-4">Register</h2>
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
            className="btn btn-primary w-100"
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : "Sign up with Google"}
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
          <a href="/login" className="text-decoration-none">
            Already have an account? Login here
          </a>
        </div>
      </div>
    </div>
  );
};

export default Register;
