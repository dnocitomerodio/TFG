import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "../utils/api";

const ArtPieceDetails = () => {
  const { external_id } = useParams();
  const [artpiece, setArtpiece] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInCollection, setIsInCollection] = useState(false);
  const [addStatus, setAddStatus] = useState("");
  const [descriptionLevel, setDescriptionLevel] = useState("none");
  const navigate = useNavigate();

  const getImageUrl = (image) => {
    if (image && image.includes("commons.wikimedia.org")) {
      const fileName = image.split("/").pop();
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${fileName}?width=500`;
    } else if (image && image.startsWith("commons:")) {
      const fileName = image.replace("commons:", "");
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${fileName}?width=500`;
    }
    return image || "https://via.placeholder.com/500x500.png?text=No+Image";
  };

  const fetchArtPiece = async (level) => {
    try {
      const { data } = await axios.get(
        `/api/artpiece/external/${external_id}?level=${level}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );
      console.log("Art piece data:", data);
      setArtpiece(data);
      setError("");
    } catch (err) {
      console.error("Art piece fetch error:", {
        message: err.message,
        response: err.response
          ? {
              status: err.response.status,
              data: err.response.data,
              headers: err.response.headers,
            }
          : "No response (possible CORS or network issue)",
      });
      if (err.response?.status === 401) {
        setError("Session expired. Please log in again.");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        navigate("/login", { replace: true });
      } else {
        setError(
          err.response?.data?.msg ||
            "Error loading art piece. Please try again later."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const checkIfInCollection = async () => {
    try {
      const { data: userData } = await axios.get("/api/user/profile", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const externalIds = userData.artpieces || [];
      setIsInCollection(externalIds.includes(external_id));
    } catch (err) {
      console.error("Check collection error:", {
        message: err.message,
        response: err.response
          ? {
              status: err.response.status,
              data: err.response.data,
            }
          : "No response (possible CORS or network issue)",
      });
      setIsInCollection(false);
    }
  };

  const handleAddToCollection = async () => {
    if (!artpiece) {
      setAddStatus("Error: Art piece data not available.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const artpieceData = {
        _id: external_id,
        external_id,
        title: artpiece.title || "Untitled",
        author: artpiece.author || "Unknown",
        museum: artpiece.museum || "Unknown",
        image: artpiece.image || "",
        inception: artpiece.inception || null,
        style: artpiece.style || null,
        location: artpiece.location || "Unknown",
        medium: artpiece.medium || "Unknown",
        dimensions: artpiece.dimensions || "Unknown",
        description: artpiece.description || "No description available",
      };
      await axios.post("/api/artpiece/add_to_user", artpieceData, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setAddStatus("Art piece added to your collection!");
      setIsInCollection(true);
    } catch (err) {
      console.error("Add to collection error:", {
        message: err.message,
        response: err.response
          ? {
              status: err.response.status,
              data: err.response.data,
            }
          : "No response (possible CORS or network issue)",
      });
      if (err.response?.status === 409) {
        setAddStatus("Art piece is already in your collection.");
        setIsInCollection(true);
      } else {
        setAddStatus(
          err.response?.data?.msg || "Failed to add artwork. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLevelChange = (newLevel) => {
    if (newLevel !== descriptionLevel) {
      setIsLoading(true);
      setDescriptionLevel(newLevel);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setIsAuthenticated(false);
      navigate("/login", { replace: true });
      return;
    }
    setIsAuthenticated(true);
    fetchArtPiece(descriptionLevel);
    checkIfInCollection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [external_id, navigate, descriptionLevel]);

  useEffect(() => {
    if (addStatus) {
      const timer = setTimeout(() => setAddStatus(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [addStatus]);

  if (!isAuthenticated) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p>Redirecting to login...</p>
      </div>
    );
  }

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
      {addStatus && (
        <p
          className={isInCollection ? "text-success mb-4" : "text-danger mb-4"}
        >
          {addStatus}
        </p>
      )}
      {artpiece && (
        <div className="card shadow-sm rounded">
          {artpiece.image && (
            <img
              src={getImageUrl(artpiece.image)}
              alt={artpiece.title || "Art piece"}
              className="card-img-top rounded-top"
              style={{
                maxHeight: "600px",
                objectFit: "contain",
                padding: "8px",
              }}
            />
          )}
          <div className="card-body">
            <h3 className="card-title">{artpiece.title || "Untitled"}</h3>
            <div className="row">
              <div className="col-md-6">
                <p className="card-text">
                  <strong>ID:</strong> {artpiece.external_id || "Unknown"}
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
              </div>
            </div>
            <div className="row">
              <div className="col-12">
                <p className="card-text">
                  <strong>Description:</strong>{" "}
                  {artpiece.description || "No description available"}
                  {descriptionLevel !== "beginner" && (
                    <span
                      className="text-primary ms-2"
                      style={{ cursor: "pointer", textDecoration: "underline" }}
                      onClick={() => handleLevelChange("beginner")}
                    >
                      Want a basic explanation?
                    </span>
                  )}
                  {descriptionLevel !== "intermediate" && (
                    <span
                      className="text-primary ms-2"
                      style={{ cursor: "pointer", textDecoration: "underline" }}
                      onClick={() => handleLevelChange("intermediate")}
                    >
                      Want an intermediate explanation?
                    </span>
                  )}
                  {descriptionLevel !== "expert" && (
                    <span
                      className="text-primary ms-2"
                      style={{ cursor: "pointer", textDecoration: "underline" }}
                      onClick={() => handleLevelChange("expert")}
                    >
                      Want an expert explanation?
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="d-flex gap-2 mt-3">
              <button className="btn btn-success btn-sm" onClick={handleBack}>
                Back
              </button>
              {!isInCollection && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleAddToCollection}
                  disabled={isLoading}
                >
                  {isLoading ? "Adding..." : "Add to Collection"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArtPieceDetails;
