import React, { useState, useEffect } from "react";
import axios from "../utils/api";
import { useNavigate } from "react-router-dom";
import ArtPieceCard from "./ArtPieceCard";

const UserCollection = () => {
  const [artworks, setArtworks] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCollection = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }
      setIsLoading(true);
      setError("");
      try {
        const { data: userData } = await axios.get("/api/user/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const externalIds = userData.artpieces || [];
        if (externalIds.length === 0) {
          setArtworks([]);
          return;
        }
        const artpiecePromises = externalIds.map((external_id) =>
          axios.get(`/api/artpiece/external/${external_id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        );
        const artpieceResponses = await Promise.all(artpiecePromises);
        setArtworks(
          artpieceResponses.map((res) => ({
            external_id: res.data.external_id || res.data._id,
            ...res.data,
          }))
        );
        setRetryCount(0);
      } catch (err) {
        console.error("Collection error:", err);
        if (err.code === "ERR_NETWORK") {
          setError(
            `Unable to connect to the server. Retry attempt ${
              retryCount + 1
            } of 3.`
          );
          setRetryCount(retryCount + 1);
        } else {
          setError(err.response?.data?.msg || "Error loading collection.");
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchCollection();
  }, [navigate, retryCount]);

  useEffect(() => {
    if (error.includes("Unable") && retryCount < 3) {
      const timer = setTimeout(() => {
        setRetryCount(retryCount + 1);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, retryCount]);

  const handleRemove = async (external_id) => {
    setError("");
    setIsLoading(true);
    try {
      await axios.delete(`/api/user/remove/${external_id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setArtworks(artworks.filter((art) => art.external_id !== external_id));
    } catch (err) {
      console.error("Remove error:", err);
      const errorMsg =
        err.response?.data?.msg || err.message || "Error removing art piece.";
      setError(errorMsg);
      if (err.code === "ERR_NETWORK") {
        try {
          const { data: userData } = await axios.get("/api/user/profile", {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });
          if (!userData.artpieces.includes(external_id)) {
            setArtworks(
              artworks.filter((art) => art.external_id !== external_id)
            );
            setError(
              "Art piece removed, but there was a network issue. UI updated."
            );
          }
        } catch (verifyErr) {
          console.error("Verification error:", verifyErr);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mt-5">
      <h2>My Collection</h2>
      {isLoading && (
        <div className="text-center">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}
      {error && (
        <p className="text-danger">
          {error}
          {error.includes("Unable") && retryCount < 3 && (
            <button
              onClick={() => setRetryCount(retryCount + 1)}
              className="btn btn-link p-0 ms-2"
              style={{ textDecoration: "none" }}
            >
              Retry Now
            </button>
          )}
        </p>
      )}
      <div className="row">
        {artworks.length === 0 && !isLoading && (
          <p>No art pieces in your collection.</p>
        )}
        {artworks.map((artpiece) => (
          <div key={artpiece.external_id} className="col-md-4 mb-4">
            <ArtPieceCard
              artpiece={artpiece}
              handleRemove={handleRemove}
              isLoading={isLoading}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserCollection;
