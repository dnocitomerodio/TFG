import React, { useState, useEffect } from "react";
import axios from "../utils/api";
import { useNavigate } from "react-router-dom";
import ArtPieceCard from "./ArtPieceCard";

const UserCollection = () => {
  const [artworks, setArtworks] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [radiusKm, setRadiusKm] = useState(5);
  const [nearbyArtworks, setNearbyArtworks] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState("");
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

  useEffect(() => {
    // Reset nearby artworks when collection changes
    setNearbyArtworks([]);
    setNearbyError("");
  }, [artworks]);

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

  const handleCheckNearby = async (e) => {
    e.preventDefault();
    setNearbyError("");
    setNearbyLoading(true);
    setNearbyArtworks([]);

    if (!navigator.geolocation) {
      setNearbyError("Geolocation is not supported by your browser.");
      setNearbyLoading(false);
      return;
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });
      const { latitude, longitude } = position.coords;

      const token = localStorage.getItem("token");
      const nearbyPromises = artworks.map((art) =>
        axios
          .get(`/api/artpiece/nearby/${art.external_id}`, {
            params: { lat: latitude, lon: longitude, radius_km: radiusKm },
            headers: { Authorization: `Bearer ${token}` },
          })
          .then((res) => ({
            ...art,
            is_nearby: res.data.is_nearby,
          }))
          .catch((err) => {
            console.error(`Error checking ${art.external_id}:`, err);
            return { ...art, is_nearby: false };
          })
      );

      const results = await Promise.all(nearbyPromises);
      const nearby = results.filter((art) => art.is_nearby);

      if (nearby.length > 0) {
        setNearbyArtworks(nearby);
        if (Notification.permission === "granted") {
          new Notification("Nearby Artworks Found!", {
            body: `The following artworks are within ${radiusKm} km:\n${nearby
              .map((art) => art.title)
              .join(", ")}`,
          });
        } else if (Notification.permission !== "denied") {
          const permission = await Notification.requestPermission();
          if (permission === "granted") {
            new Notification("Nearby Artworks Found!", {
              body: `The following artworks are within ${radiusKm} km:\n${nearby
                .map((art) => art.title)
                .join(", ")}`,
            });
          }
        }
      } else {
        setNearbyError(
          `No artworks found within ${radiusKm} km of your location.`
        );
      }
    } catch (err) {
      console.error("Geolocation error:", err);
      let errorMsg = "Error checking nearby artworks.";
      if (err.code === 1) {
        errorMsg = "Geolocation permission denied.";
      } else if (err.code === 2) {
        errorMsg = "Unable to retrieve your location.";
      } else if (err.code === 3) {
        errorMsg = "Geolocation request timed out.";
      }
      setNearbyError(errorMsg);
    } finally {
      setNearbyLoading(false);
    }
  };

  return (
    <div className="container mt-5">
      <h2>My Collection</h2>
      <form onSubmit={handleCheckNearby} className="mb-4">
        <div className="input-group">
          <input
            type="number"
            className="form-control"
            value={radiusKm}
            onChange={(e) =>
              setRadiusKm(Math.max(1, Math.min(100, e.target.value)))
            }
            min="1"
            max="100"
            step="1"
            placeholder="Enter radius in km"
            aria-label="Radius in kilometers"
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={nearbyLoading || artworks.length === 0}
          >
            {nearbyLoading ? (
              <span
                className="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
              ></span>
            ) : (
              "Check Nearby"
            )}
          </button>
        </div>
        {nearbyError && <p className="text-danger mt-2">{nearbyError}</p>}
        {nearbyArtworks.length > 0 && (
          <p className="text-success mt-2">
            Found {nearbyArtworks.length} artwork(s) within {radiusKm} km:{" "}
            {nearbyArtworks.map((art) => art.title).join(", ")}
          </p>
        )}
      </form>
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
