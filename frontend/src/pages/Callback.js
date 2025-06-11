import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

const Callback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleGoogleCallback = async () => {
      const params = new URLSearchParams(location.search);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        try {
          localStorage.setItem("token", accessToken);
          localStorage.setItem("refreshToken", refreshToken);

          const decoded = jwtDecode(accessToken);
          console.log("Decoded Google token:", decoded);
          const email = decoded.identity || decoded.sub;

          setMessage(`Welcome, ${email}! Google authentication successful.`);
          setTimeout(() => navigate("/"), 2000);
        } catch (error) {
          console.error("Google OAuth error:", error);
          setMessage("Failed to process Google authentication.");
          setTimeout(() => navigate("/login"), 2000);
        } finally {
          setIsLoading(false);
        }
      } else {
        setMessage("Invalid Google authentication response.");
        setIsLoading(false);
        setTimeout(() => navigate("/login"), 2000);
      }
    };

    handleGoogleCallback();
  }, [location, navigate]);

  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="card shadow p-4" style={{ width: "400px" }}>
        <h2 className="text-center mb-4">Processing Authentication</h2>
        {isLoading ? (
          <p className="text-center">Loading...</p>
        ) : (
          <p
            className={`text-center ${
              message.includes("Failed") ? "text-danger" : "text-success"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default Callback;
