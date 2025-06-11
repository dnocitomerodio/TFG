import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "../utils/api";

const CollectionDetail = () => {
  const { external_id } = useParams();
  const [artpiece, setArtpiece] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchArtPiece = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }
      try {
        const { data } = await axios.get(
          `/api/artpiece/external/${external_id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        console.log("Art piece data:", data);
        setArtpiece(data);
        setError("");
      } catch (err) {
        console.error("Art piece error:", err);
        if (err.response?.status === 401) {
          setError("Session expired. Please log in again.");
          localStorage.removeItem("token");
          localStorage.removeItem("refreshToken");
          navigate("/login");
        } else {
          setError(err.response?.data?.msg || "Error loading art piece.");
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchArtPiece();
  }, [external_id, navigate]);

  if (isLoading) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p>Loading art piece...</p>
      </div>
    );
  }

  return (
    <div className="container mt-5">
      <h2 className="mb-4">Art Piece Details</h2>
      {error && <p className="text-danger mb-4">{error}</p>}
      {artpiece && (
        <div className="card shadow-sm rounded">
          {artpiece.image && (
            <img
              src={artpiece.image}
              alt={artpiece.title || "Art piece"}
              className="card-img-top rounded-top"
              style={{
                maxHeight: "500px",
                objectFit: "contain",
                padding: "1rem",
              }}
            />
          )}
          <div className="card-body">
            <h3 className="card-title">{artpiece.title || "Untitled"}</h3>
            <div className="row">
              <div className="col-md-6">
                <p className="card-text">
                  <strong>ID:</strong> {artpiece._id || "Unknown"}
                </p>
                <p className="card-text">
                  <strong>Artist:</strong> {artpiece.author || "Unknown"}
                </p>
                <p className="card-text">
                  <strong>Museum:</strong> {artpiece.museum || "Unknown"}
                </p>
                <p className="card-text">
                  <strong>Inception:</strong>{" "}
                  {artpiece.inception
                    ? new Date(artpiece.inception).getFullYear()
                    : "Unknown"}
                </p>
                <p className="card-text">
                  <strong>Style:</strong> {artpiece.style || "Unknown"}
                </p>
              </div>
              <div className="col-md-6">
                <p className="card-text">
                  <strong>Location:</strong> {artpiece.location || "Unknown"}
                </p>
                <p className="card-text">
                  <strong>Medium:</strong> {artpiece.medium || "Unknown"}
                </p>
                <p className="card-text">
                  <strong>Dimensions:</strong>{" "}
                  {artpiece.dimensions || "Unknown"}
                </p>
                <p className="card-text">
                  <strong>Description:</strong>{" "}
                  {artpiece.description || "No description available"}
                </p>
              </div>
            </div>
          </div>
          <Link to="/collection" className="btn btn-success btn-sm">
            Back to Collection
          </Link>
        </div>
      )}
    </div>
  );
};

export default CollectionDetail;
