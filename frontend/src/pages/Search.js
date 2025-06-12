import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../utils/api";

const Search = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [artistResults, setArtistResults] = useState([]);
  const [artistInfo, setArtistInfo] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [offset, setOffset] = useState(0);
  const [searchOffset, setSearchOffset] = useState(0);
  const [searchPage, setSearchPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchMode, setSearchMode] = useState("title"); // "title" or "artist"
  const pageSize = 10;
  const navigate = useNavigate();

  const getImageUrl = (image) => {
    if (image && image.includes("commons.wikimedia.org")) {
      const fileName = image.split("/").pop();
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${fileName}?width=200`;
    } else if (image && image.startsWith("commons:")) {
      const fileName = image.replace("commons:", "");
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${fileName}?width=200`;
    }
    return image || "https://via.placeholder.com/200x200.png?text=No+Image";
  };

  const renderCard = (item, index, type) => (
    <div key={item.external_id || `${type}-${index}`} className="col-md-4 mb-4">
      <div className="card shadow-sm">
        {item.image && (
          <img
            src={getImageUrl(item.image)}
            alt={item.title}
            className="card-img-top"
            style={{
              maxHeight: "200px",
              objectFit: "contain",
              padding: "0.5rem",
            }}
          />
        )}
        <div className="card-body">
          <h5 className="card-title">{item.title || "Untitled"}</h5>
          <p className="card-text">
            <strong>Artist:</strong> {item.author || "Unknown"}
          </p>
          <p className="card-text">
            <strong>Museum:</strong> {item.museum || "Unknown"}
          </p>
          <p className="card-text">
            <strong>Description:</strong>{" "}
            {item.description || "No description available"}
          </p>
          <a
            href={`/artpiece/${item.external_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm"
          >
            View Details
          </a>
        </div>
      </div>
    </div>
  );

  const fetchRecommendations = async (newOffset) => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.get("/api/artpiece/recommendations", {
        params: {
          level: "none",
          offset: newOffset,
          limit: pageSize,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.log("Recommendations data:", response.data);
      const validRecommendations = (response.data || []).filter(
        (item) => item?.external_id
      );
      setRecommendations(validRecommendations);
      setError("");
    } catch (err) {
      console.error("Recommendations fetch error:", {
        message: err.message,
        response: err.response
          ? {
              status: err.response.status,
              data: err.response.data,
              headers: err.response.headers,
            }
          : "No response (possible CORS issue)",
      });
      if (err.response?.status === 401) {
        setError("Session expired. Please log in again.");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        navigate("/login");
      } else {
        setError(err.response?.data?.msg || "Error loading recommendations.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTitleSearch = async (e, offset = 0) => {
    if (e) e.preventDefault();
    if (!query.trim()) {
      setError("Please enter a search term.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.get("/api/artpiece/", {
        params: {
          query,
          limit: pageSize,
          offset,
          expand: true,
        },
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      console.log("Title search results:", response.data);
      const validResults = (response.data || []).filter(
        (item) => item?.external_id
      );
      setResults(validResults);
      setArtistResults([]);
      setArtistInfo(null);
      setError("");
    } catch (err) {
      console.error("Title search error:", {
        message: err.message,
        response: err.response?.data || "No response",
      });
      if (err.response?.status === 401) {
        setError("Session expired. Please log in again.");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        navigate("/login");
      } else {
        setError(err.response?.data?.msg || "Error searching artworks.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleArtistSearch = async (e, offset = 0) => {
    if (e) e.preventDefault();
    if (!query.trim()) {
      setError("Please enter an artist name.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.get("/api/artpiece/artist", {
        params: {
          query,
          offset,
          limit: pageSize,
        },
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      console.log("Artist search results:", response.data);
      const seen = new Set();
      const validArtworks = (response.data.artworks || []).filter((item) => {
        if (!item?.external_id) return false;
        const key = `${item.external_id}|${(item.title || "").toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          return true;
        }
        return false;
      });
      setArtistResults(validArtworks);
      setArtistInfo(response.data.artist || null);
      setResults([]);
      setError("");
    } catch (err) {
      console.error("Artist search error:", {
        message: err.message,
        response: err.response?.data || "No response",
      });
      if (err.response?.status === 401) {
        setError("Session expired. Please log in again.");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        navigate("/login");
      } else if (err.response?.status === 404) {
        setError(`Artist '${query}' not found.`);
      } else {
        setError(err.response?.data?.msg || "Error searching artist artworks.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearchOffset(0);
    setSearchPage(1);
    if (searchMode === "artist") {
      handleArtistSearch(e);
    } else {
      handleTitleSearch(e);
    }
  };

  const handleSearchPagination = (direction) => {
    const newOffset =
      direction === "next"
        ? searchOffset + pageSize
        : Math.max(searchOffset - pageSize, 0);
    setSearchOffset(newOffset);
    setSearchPage(
      direction === "next" ? searchPage + 1 : Math.max(searchPage - 1, 1)
    );
    if (searchMode === "artist") {
      handleArtistSearch(null, newOffset);
    } else {
      handleTitleSearch(null, newOffset);
    }
  };

  const handlePagination = (direction) => {
    const newOffset =
      direction === "next" ? offset + pageSize : Math.max(offset - pageSize, 0);
    setOffset(newOffset);
    fetchRecommendations(newOffset);
  };

  const handleSearchMode = (mode) => {
    setSearchMode(mode);
    setQuery("");
    setResults([]);
    setArtistResults([]);
    setArtistInfo(null);
    setSearchOffset(0);
    setSearchPage(1);
    setError("");
  };

  useEffect(() => {
    fetchRecommendations(offset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  return (
    <div className="container mt-5">
      <h2 className="mb-4">Search Artworks</h2>
      {error && <p className="text-danger mb-4">{error}</p>}

      {/* Search Bar */}
      <div className="mb-4">
        <form onSubmit={handleSearch}>
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              placeholder={
                searchMode === "artist"
                  ? "Search artworks by artist..."
                  : "Search artworks by title..."
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              className="btn btn-success"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? "Searching..." : "Search"}
            </button>
          </div>
        </form>
      </div>

      {/* Search Modalities */}
      <div className="mb-4">
        <h5>Search Options</h5>
        <button
          className={`btn ${
            searchMode === "title" ? "btn-primary" : "btn-outline-primary"
          } me-2`}
          onClick={() => handleSearchMode("title")}
        >
          Search by Title
        </button>
        <button
          className={`btn ${
            searchMode === "artist" ? "btn-primary" : "btn-outline-primary"
          } me-2`}
          onClick={() => handleSearchMode("artist")}
        >
          Search by Artist
        </button>
        <button
          className="btn btn-outline-primary me-2"
          onClick={() => alert("Find Nearby Museums will be implemented soon!")}
        >
          Find Nearby Museums
        </button>
        <button
          className="btn btn-outline-primary"
          onClick={() => alert("Search by Museum will be implemented soon!")}
        >
          Search by Museum
        </button>
      </div>

      {/* Artist Info */}
      {artistInfo && (
        <div className="mb-4">
          <h4>Artist: {artistInfo.label}</h4>
          <p>{artistInfo.description || "No description available."}</p>
          {artistInfo.wikipedia_url && (
            <a
              href={artistInfo.wikipedia_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline-info btn-sm"
            >
              View on Wikipedia
            </a>
          )}
        </div>
      )}

      {/* Results or Recommendations */}
      {results.length > 0 || artistResults.length > 0 ? (
        <>
          <h4>
            {searchMode === "artist" ? "Artist Artworks" : "Search Results"}
          </h4>
          <div className="row">
            {(searchMode === "artist" ? artistResults : results).map(
              (item, index) => renderCard(item, index, searchMode)
            )}
          </div>
          <div className="d-flex justify-content-between">
            <button
              className="btn btn-secondary"
              onClick={() => handleSearchPagination("prev")}
              disabled={searchOffset === 0 || isLoading}
            >
              Previous
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => handleSearchPagination("next")}
              disabled={
                (searchMode === "artist"
                  ? artistResults.length
                  : results.length) < pageSize || isLoading
              }
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <>
          <h4>Recommended Artworks</h4>
          {isLoading ? (
            <div className="text-center">
              <div className="spinner-border text-success" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p>Loading recommendations...</p>
            </div>
          ) : recommendations.length > 0 ? (
            <>
              <div className="row">
                {recommendations.map((item, index) =>
                  renderCard(item, index, "recommendation")
                )}
              </div>
              <div className="d-flex justify-content-between">
                <button
                  className="btn btn-secondary"
                  onClick={() => handlePagination("prev")}
                  disabled={offset === 0 || isLoading}
                >
                  Previous
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handlePagination("next")}
                  disabled={recommendations.length < pageSize || isLoading}
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <p>
              No recommendations available. Try adding some artworks to your
              collection!
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default Search;
