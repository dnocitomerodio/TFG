import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "../utils/api";

const Search = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [artistResults, setArtistResults] = useState([]);
  const [artistInfo, setArtistInfo] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [museumResults, setMuseumResults] = useState([]);
  const [offset, setOffset] = useState(0);
  const [searchOffset, setSearchOffset] = useState(0);
  const [museumOffset, setMuseumOffset] = useState(0);
  const [searchPage, setSearchPage] = useState(1);
  const [museumPage, setMuseumPage] = useState(1);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isRecommendationsLoading, setIsRecommendationsLoading] =
    useState(false);
  const [error, setError] = useState("");
  const [searchMode, setSearchMode] = useState("title");
  const [radiusKm, setRadiusKm] = useState(5);
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

  const saveSearchState = () => {
    const searchState = {
      query,
      searchMode,
      results,
      artistResults,
      artistInfo,
      museumResults,
      searchOffset,
      searchPage,
      museumOffset,
      museumPage,
      radiusKm,
    };
    localStorage.setItem("searchState", JSON.stringify(searchState));
  };

  const loadSearchState = () => {
    const savedState = localStorage.getItem("searchState");
    if (savedState) {
      const {
        query: savedQuery,
        searchMode: savedMode,
        results: savedResults,
        artistResults: savedArtistResults,
        artistInfo: savedArtistInfo,
        museumResults: savedMuseumResults,
        searchOffset: savedOffset,
        searchPage: savedPage,
        museumOffset: savedMuseumOffset,
        museumPage: savedMuseumPage,
        radiusKm: savedRadiusKm,
      } = JSON.parse(savedState);
      setQuery(savedQuery || "");
      setSearchMode(savedMode || "title");
      setResults(savedResults || []);
      setArtistResults(savedArtistResults || []);
      setArtistInfo(savedArtistInfo || null);
      setMuseumResults(savedMuseumResults || []);
      setSearchOffset(savedOffset || 0);
      setSearchPage(savedPage || 1);
      setMuseumOffset(savedMuseumOffset || 0);
      setMuseumPage(savedMuseumPage || 1);
      setRadiusKm(savedRadiusKm || 5);
      return { savedQuery, savedMode, savedOffset, savedRadiusKm };
    }
    return null;
  };

  const clearSearchState = () => {
    localStorage.removeItem("searchState");
  };

  const renderCard = (item, index, type) => (
    <div
      key={item.id || item.external_id || `${type}-${index}`}
      className="col-md-4 mb-4"
    >
      <div className="card shadow-sm">
        {item.image && (
          <img
            src={getImageUrl(item.image)}
            alt={type === "museum" ? item.name : item.title}
            className="card-img-top"
            style={{
              maxHeight: "200px",
              objectFit: "contain",
              padding: "0.5rem",
            }}
          />
        )}
        <div className="card-body">
          <h5 className="card-title">
            {type === "museum" ? item.name : item.title || "Untitled"}
          </h5>
          {type === "museum" ? (
            <>
              {item.distance_km !== undefined && (
                <p className="card-text">
                  <strong>Distance:</strong> {item.distance_km.toFixed(2)} km
                </p>
              )}
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                >
                  Visit Website
                </a>
              )}
            </>
          ) : (
            <>
              <p className="card-text">
                <strong>Artist:</strong> {item.author || "Unknown"}
              </p>
              <p className="card-text">
                <strong>Museum:</strong> {item.museum || "Unknown"}
              </p>
              <Link
                to={`/artpiece/${item.id || item.external_id}`}
                className="btn btn-primary btn-sm"
              >
                View Details
              </Link>
            </>
          )}
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

    setIsRecommendationsLoading(true);
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
        setError(err.response?.data?.msg || "Error loading recommendations");
      }
    } finally {
      setIsRecommendationsLoading(false);
    }
  };

  const handleTitleSearch = async (e, offset = 0, overrideQuery = null) => {
    if (e) e.preventDefault();
    const searchQuery = overrideQuery !== null ? overrideQuery : query;
    if (!searchQuery?.trim()) {
      setError("Please enter a search term.");
      return;
    }

    setIsSearchLoading(true);
    try {
      const response = await axios.get("/api/artpiece/", {
        params: {
          query: searchQuery,
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
      setMuseumResults([]);
      setError("");
      saveSearchState();
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
        setError(err.response?.data?.msg || "Error searching artworks");
      }
    } finally {
      setIsSearchLoading(false);
    }
  };

  const handleArtistSearch = async (e, offset = 0, overrideQuery = null) => {
    if (e) e.preventDefault();
    const searchQuery = overrideQuery !== null ? overrideQuery : query;
    if (!searchQuery?.trim()) {
      setError("Please enter an artist name.");
      return;
    }

    setIsSearchLoading(true);
    try {
      const response = await axios.get("/api/artpiece/artist", {
        params: {
          query: searchQuery,
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
      setMuseumResults([]);
      setError("");
      saveSearchState();
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
        setError(`Artist '${searchQuery}' not found.`);
      } else {
        setError(err.response?.data?.msg || "Error searching artist artworks");
      }
    } finally {
      setIsSearchLoading(false);
    }
  };

  const handleMuseumSearch = async (newOffset = 0, newRadius = radiusKm) => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setIsSearchLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          const response = await axios.get("/api/artpiece/nearby_museums", {
            params: {
              lat: latitude,
              lon: longitude,
              radius_km: newRadius,
              offset: newOffset,
              limit: pageSize,
            },
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });
          console.log("Museum search results:", response.data);
          const seen = new Set();
          const validMuseums = (response.data || []).filter((item) => {
            if (!item?.name || !item?.id) return false;
            if (!seen.has(item.id)) {
              seen.add(item.id);
              return true;
            }
            return false;
          });
          console.log("Unique museum results:", validMuseums);
          setMuseumResults(validMuseums);
          setResults([]);
          setArtistResults([]);
          setArtistInfo(null);
          setRecommendations([]);
          setSearchMode("museum");
          setError(validMuseums.length ? "" : "No museums found nearby.");
          saveSearchState();
        } catch (err) {
          console.error("Museum search error:", {
            message: err.message,
            response: err.response?.data || "No response",
          });
          if (err.response?.status === 401) {
            setError("Session expired. Please log in again.");
            localStorage.removeItem("token");
            localStorage.removeItem("refreshToken");
            navigate("/login");
          } else if (err.response?.status === 400) {
            setError("Invalid location parameters.");
          } else {
            setError(
              err.response?.data?.msg || "Error searching nearby museums"
            );
          }
        } finally {
          setIsSearchLoading(false);
        }
      },
      (err) => {
        setError("Location access denied. Please enable location services.");
        setIsSearchLoading(false);
      }
    );
  };

  const handleSearch = (e) => {
    clearSearchState();
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
    } else if (searchMode === "title") {
      handleTitleSearch(null, newOffset);
    }
  };

  const handleMuseumPagination = (direction) => {
    const newOffset =
      direction === "next"
        ? museumOffset + pageSize
        : Math.max(museumOffset - pageSize, 0);
    setMuseumOffset(newOffset);
    setMuseumPage(
      direction === "next" ? museumPage + 1 : Math.max(museumPage - 1, 1)
    );
    handleMuseumSearch(newOffset);
  };

  const handlePagination = (direction) => {
    const newOffset =
      direction === "next" ? offset + pageSize : Math.max(offset - pageSize, 0);
    setOffset(newOffset);
    fetchRecommendations(newOffset);
  };

  const handleSearchMode = (mode) => {
    clearSearchState();
    setSearchMode(mode);
    setQuery("");
    setResults([]);
    setArtistResults([]);
    setArtistInfo(null);
    setMuseumResults([]);
    setSearchOffset(0);
    setSearchPage(1);
    setMuseumOffset(0);
    setMuseumPage(1);
    setError("");
    if (mode === "museum") {
      handleMuseumSearch();
    }
  };

  const handleRadiusChange = (e) => {
    const newRadius = parseInt(e.target.value, 10);
    setRadiusKm(newRadius);
    setMuseumOffset(0);
    setMuseumPage(1);
    handleMuseumSearch(0, newRadius);
  };

  useEffect(() => {
    const savedState = loadSearchState();
    if (savedState && savedState.savedQuery?.trim()) {
      if (savedState.savedMode === "artist") {
        handleArtistSearch(null, savedState.savedOffset, savedState.savedQuery);
      } else if (savedState.savedMode === "title") {
        handleTitleSearch(null, savedState.savedOffset, savedState.savedQuery);
      }
    }
    fetchRecommendations(offset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  return (
    <div className="container mt-5">
      <style>
        {`
          .btn-success:disabled {
            opacity: 1;
          }
          .radius-slider {
            width: 100%;
            margin: 1rem 0;
          }
          .radius-label {
            font-size: 1rem;
            margin-bottom: 0.5rem;
          }
        `}
      </style>
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
              disabled={isSearchLoading}
            >
              {isSearchLoading ? "Searching..." : "Search"}
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
          className={`btn ${
            searchMode === "museum" ? "btn-primary" : "btn-outline-primary"
          } me-2`}
          onClick={() => handleSearchMode("museum")}
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

      {/* Radius Slider for Museum Search */}
      {searchMode === "museum" && (
        <div className="mb-4">
          <label className="radius-label">Search radius: {radiusKm} km</label>
          <input
            type="range"
            className="radius-slider"
            min="1"
            max="50"
            step="1"
            value={radiusKm}
            onChange={handleRadiusChange}
            disabled={isSearchLoading}
          />
        </div>
      )}

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
      {results.length > 0 ||
      artistResults.length > 0 ||
      museumResults.length > 0 ? (
        <>
          <h4>
            {searchMode === "artist"
              ? "Artist Artworks"
              : searchMode === "museum"
              ? "Nearby Museums"
              : "Search Results"}
          </h4>
          {isSearchLoading ? (
            <div className="text-center">
              <div className="spinner-border text-success" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p>
                Loading {searchMode === "museum" ? "museums" : "search results"}
                ...
              </p>
            </div>
          ) : (
            <>
              <div className="row">
                {(searchMode === "artist"
                  ? artistResults
                  : searchMode === "museum"
                  ? museumResults
                  : results
                ).map((item, index) =>
                  renderCard(
                    item,
                    index,
                    searchMode === "museum" ? "museum" : searchMode
                  )
                )}
              </div>
              <div className="d-flex justify-content-between">
                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    searchMode === "museum"
                      ? handleMuseumPagination("prev")
                      : handleSearchPagination("prev")
                  }
                  disabled={
                    (searchMode === "museum" ? museumOffset : searchOffset) ===
                      0 || isSearchLoading
                  }
                >
                  Previous
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    searchMode === "museum"
                      ? handleMuseumPagination("next")
                      : handleSearchPagination("next")
                  }
                  disabled={
                    (searchMode === "museum"
                      ? museumResults.length
                      : searchMode === "artist"
                      ? artistResults.length
                      : results.length) < pageSize || isSearchLoading
                  }
                >
                  Next
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <h4>Recommended Artworks</h4>
          {isRecommendationsLoading ? (
            <div className="text-center">
              <div className="spinner-border text-success" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p>Loading recommendations...</p>
            </div>
          ) : recommendations.length ? (
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
                  disabled={offset === 0 || isRecommendationsLoading}
                >
                  Previous
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handlePagination("next")}
                  disabled={
                    recommendations.length < pageSize ||
                    isRecommendationsLoading
                  }
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
