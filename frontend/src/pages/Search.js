/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import axios from "../utils/api";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  Circle,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const redIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  iconRetinaUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const SearchRadiusCircle = ({ userLocation, radiusKm }) => {
  const map = useMap();
  if (!userLocation) return null;
  return (
    <Circle
      center={[userLocation.lat, userLocation.lon]}
      radius={radiusKm * 1000}
      pathOptions={{
        color: "#007bff",
        fillColor: "#007bff",
        fillOpacity: 0.2,
        weight: 2,
      }}
    >
      <Popup>Search radius: {radiusKm} km</Popup>
    </Circle>
  );
};

const MapBounds = ({ userLocation, museums, radiusKm }) => {
  const map = useMap();
  useEffect(() => {
    if (userLocation && museums.length) {
      const museumBounds = L.latLngBounds(
        museums
          .filter((museum) => museum.latitude && museum.longitude)
          .map((museum) => [museum.latitude, museum.longitude])
      );
      const radiusInDegrees = radiusKm / 111;
      const radiusBounds = L.latLngBounds([
        [
          userLocation.lat - radiusInDegrees,
          userLocation.lon - radiusInDegrees,
        ],
        [
          userLocation.lat + radiusInDegrees,
          userLocation.lon + radiusInDegrees,
        ],
      ]);
      const combinedBounds = museumBounds
        .extend([userLocation.lat, userLocation.lon])
        .extend(radiusBounds);
      map.fitBounds(combinedBounds, { padding: [50, 50] });
    } else if (userLocation) {
      map.setView([userLocation.lat, userLocation.lon], 13);
    }
  }, [map, userLocation, museums, radiusKm]);
  return null;
};

const Search = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [artistResults, setArtistResults] = useState([]);
  const [artistInfo, setArtistInfo] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [allMuseumResults, setAllMuseumResults] = useState([]);
  const [museumResults, setMuseumResults] = useState([]);
  const [allMuseumArtworks, setAllMuseumArtworks] = useState([]);
  const [museumArtworks, setMuseumArtworks] = useState([]);
  const [offset, setOffset] = useState(0);
  const [searchOffset, setSearchOffset] = useState(0);
  const [searchPage, setSearchPage] = useState(1);
  const [museumPage, setMuseumPage] = useState(1);
  const [museumArtworksPage, setMuseumArtworksPage] = useState(1);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isRecommendationsLoading, setIsRecommendationsLoading] =
    useState(false);
  const [error, setError] = useState("");
  const [searchMode, setSearchMode] = useState("title");
  const [viewMode, setViewMode] = useState("main");
  const [radiusKm, setRadiusKm] = useState(5);
  const [customRadius, setCustomRadius] = useState("");
  const [currentMuseumId, setCurrentMuseumId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const pageSize = 10;

  const getImageUrl = (image) => {
    if (image && image.includes("commons.wikimedia.org")) {
      const fileName = image.split("/").pop();
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${fileName}?width=200`;
    } else if (image && image.startsWith("commons:")) {
      const fileName = image.replace("commons:", "");
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${fileName}?width=200`;
    }
    return image && image !== "" ? image : "https://picsum.photos/300/200.jpg";
  };

  const saveSearchState = () => {
    const searchState = {
      query,
      searchMode,
      viewMode,
      results,
      artistResults,
      artistInfo,
      allMuseumResults,
      museumResults,
      allMuseumArtworks,
      museumArtworks,
      searchOffset,
      searchPage,
      museumPage,
      museumArtworksPage,
      radiusKm,
      customRadius,
      currentMuseumId,
      userLocation,
    };
    localStorage.setItem("searchState", JSON.stringify(searchState));
  };

  const loadSearchResult = () => {
    const savedState = localStorage.getItem("searchState");
    if (savedState) {
      const {
        query: savedQuery,
        searchMode: savedMode,
        viewMode: savedViewMode,
        results: savedResults,
        artistResults: savedArtistResults,
        artistInfo: savedArtistInfo,
        allMuseumResults,
        museumResults: savedMuseumResults,
        allMuseumArtworks: savedAllMuseumArtworks,
        museumArtworks: savedMuseumArtworks,
        searchOffset: savedOffset,
        searchPage: savedPage,
        museumPage: savedMuseumPage,
        museumArtworksPage: savedMuseumArtworksPage,
        radiusKm: savedRadiusKm,
        customRadius: savedCustomRadius,
        currentMuseumId: savedMuseumId,
        userLocation: savedUserLocation,
      } = JSON.parse(savedState);
      setQuery(savedQuery || "");
      setSearchMode(savedMode || "title");
      setViewMode(savedViewMode || "main");
      setResults(savedResults || []);
      setArtistResults(savedArtistResults || []);
      setArtistInfo(savedArtistInfo || null);
      setAllMuseumResults(
        Array.isArray(allMuseumResults) ? allMuseumResults : []
      );
      setMuseumResults(
        Array.isArray(savedMuseumResults) ? savedMuseumResults : []
      );
      setAllMuseumArtworks(
        Array.isArray(savedAllMuseumArtworks) ? savedAllMuseumArtworks : []
      );
      setMuseumArtworks(
        Array.isArray(savedMuseumArtworks) ? savedMuseumArtworks : []
      );
      setSearchOffset(savedOffset || 0);
      setSearchPage(savedPage || 1);
      setMuseumPage(savedMuseumPage || 1);
      setMuseumArtworksPage(savedMuseumArtworksPage || 1);
      setRadiusKm(savedRadiusKm || 5);
      setCustomRadius(savedCustomRadius || "");
      setCurrentMuseumId(savedMuseumId || null);
      setUserLocation(savedUserLocation || null);
      return {
        savedQuery,
        savedMode,
        searchRadius: savedRadiusKm,
        customRadius: savedCustomRadius,
        savedViewMode,
        savedMuseumId,
        savedOffset,
        savedMuseumPage,
        savedMuseumArtworksPage,
      };
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
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleViewMuseum(item.id)}
              >
                View Museum
              </button>
            </>
          ) : (
            <>
              <p className="card-text">
                <strong>Artist:</strong> {item.author || "Unknown"}
              </p>
              {viewMode !== "museumArtworks" && (
                <p className="card-text">
                  <strong>Museum:</strong> {item.museum || "Unknown"}
                </p>
              )}
              <Link
                to={`/artpiece/${item.id || item.external_id}`}
                className="btn btn-primary btn-sm"
                onClick={saveSearchState}
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
        cache: "no-store",
      });
      console.log(
        "Recommendations fetched with offset:",
        newOffset,
        response.data
      );
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
        cache: "no-store",
      });
      console.log("Title search results with offset:", offset, response.data);
      const validResults = (response.data || []).filter(
        (item) => item?.external_id
      );
      setResults(validResults);
      setArtistResults([]);
      setArtistInfo(null);
      setAllMuseumResults([]);
      setMuseumResults([]);
      setAllMuseumArtworks([]);
      setMuseumArtworks([]);
      setViewMode("main");
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
        cache: "no-store",
      });
      console.log("Artist search results with offset:", offset, response.data);
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
      setAllMuseumResults([]);
      setMuseumResults([]);
      setAllMuseumArtworks([]);
      setMuseumArtworks([]);
      setViewMode("main");
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

  const handleMuseumSearch = async (newRadius = radiusKm) => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setIsSearchLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lon: longitude });

        try {
          const response = await axios.get("/api/artpiece/nearby_museums", {
            params: {
              lat: latitude,
              lon: longitude,
              radius_km: newRadius,
            },
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            cache: "no-store",
          });
          console.log("Museum search results:", response.data);
          const seen = new Set();
          const validMuseums = (
            Array.isArray(response.data) ? response.data : []
          ).filter((item) => {
            if (!item?.name || !item?.id) return false;
            if (!seen.has(item.id)) {
              seen.add(item.id);
              return true;
            }
            return false;
          });
          console.log("Unique museum results:", validMuseums);
          setAllMuseumResults(validMuseums);
          setMuseumResults(validMuseums.slice(0, pageSize));
          setMuseumPage(1);
          setResults([]);
          setArtistResults([]);
          setArtistInfo(null);
          setRecommendations([]);
          setAllMuseumArtworks([]);
          setMuseumArtworks([]);
          setSearchMode("museum");
          setViewMode("main");
          setError(
            validMuseums.length
              ? ""
              : `No museums found within ${newRadius} km.`
          );
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
        console.error("Geolocation error:", {
          code: err.code,
          message: err.message,
        });
        let errorMessage;
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage =
              "Location access denied. Please enable location services.";
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage =
              "Unable to retrieve location. The geolocation service may be temporarily unavailable.";
            break;
          case err.TIMEOUT:
            errorMessage = "Location request timed out. Please try again.";
            break;
          default:
            errorMessage = "An error occurred while retrieving your location.";
        }
        setError(errorMessage);
        setIsSearchLoading(false);
      }
    );
  };

  const handleViewMuseum = async (museumId) => {
    setIsSearchLoading(true);
    setError("");
    setCurrentMuseumId(museumId);

    try {
      const response = await axios.get(
        `/api/artpiece/museum_works/${museumId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          cache: "no-store",
        }
      );
      console.log("Museum artworks results:", response.data);
      const seen = new Set();
      const validArtworks = (
        Array.isArray(response.data.artworks) ? response.data.artworks : []
      ).filter((item) => {
        if (!item?.external_id) return false;
        if (!seen.has(item.external_id)) {
          seen.add(item.external_id);
          return true;
        }
        return false;
      });
      console.log("Unique museum artworks:", validArtworks);
      setAllMuseumArtworks(validArtworks);
      setMuseumArtworks(validArtworks.slice(0, pageSize));
      setMuseumArtworksPage(1);
      setViewMode("museumArtworks");
      setError(
        validArtworks.length ? "" : "No artworks found for this museum."
      );
      saveSearchState();
    } catch (err) {
      console.error("Museum artworks error:", {
        message: err.message,
        response: err.response?.data || "No response",
      });
      if (err.response?.status === 401) {
        setError("Session expired. Please log in again.");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        navigate("/login");
      } else {
        setError(err.response?.data?.msg || "Error fetching museum artworks");
      }
    } finally {
      setIsSearchLoading(false);
    }
  };

  const handleMuseumArtworksPagination = (direction) => {
    const newPage =
      direction === "next"
        ? museumArtworksPage + 1
        : Math.max(museumArtworksPage - 1, 1);
    console.log("Museum artworks pagination:", {
      direction,
      newPage,
      totalItems: allMuseumArtworks.length,
    });
    setMuseumArtworksPage(newPage);
    setMuseumArtworks(
      Array.isArray(allMuseumArtworks)
        ? allMuseumArtworks.slice((newPage - 1) * pageSize, newPage * pageSize)
        : []
    );
    saveSearchState();
  };

  const handleBackToMuseums = () => {
    setAllMuseumArtworks([]);
    setMuseumArtworks([]);
    setMuseumArtworksPage(1);
    setCurrentMuseumId(null);
    setViewMode("main");
    setError("");
    setMuseumResults(
      Array.isArray(allMuseumResults)
        ? allMuseumResults.slice(
            (museumPage - 1) * pageSize,
            museumPage * pageSize
          )
        : []
    );
    saveSearchState();
  };

  const handleSearch = (e) => {
    e.preventDefault();
    clearSearchState();
    setSearchOffset(0);
    setSearchPage(1);
    setAllMuseumArtworks([]);
    setMuseumArtworks([]);
    setMuseumArtworksPage(1);
    setCurrentMuseumId(null);
    setViewMode("main");
    if (searchMode === "artist") {
      handleArtistSearch(null, 0, query);
    } else {
      handleTitleSearch(null, 0, query);
    }
  };

  const handleSearchPagination = (direction) => {
    const newOffset =
      direction === "next"
        ? searchOffset + pageSize
        : Math.max(searchOffset - pageSize, 0);
    console.log("Search pagination:", {
      direction,
      newOffset,
      currentPage: searchPage,
    });
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
    const newPage =
      direction === "next" ? museumPage + 1 : Math.max(museumPage - 1, 1);
    console.log("Museum pagination:", {
      direction,
      newPage,
      totalItems: allMuseumResults.length,
    });
    setMuseumPage(newPage);
    setMuseumResults(
      Array.isArray(allMuseumResults)
        ? allMuseumResults.slice((newPage - 1) * pageSize, newPage * pageSize)
        : []
    );
    saveSearchState();
  };

  const handlePagination = (direction) => {
    const newOffset =
      direction === "next" ? offset + pageSize : Math.max(offset - pageSize, 0);
    console.log("Recommendations pagination:", { direction, newOffset });
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
    setAllMuseumResults([]);
    setMuseumResults([]);
    setAllMuseumArtworks([]);
    setMuseumArtworks([]);
    setSearchOffset(0);
    setSearchPage(1);
    setMuseumPage(1);
    setMuseumArtworksPage(1);
    setViewMode("main");
    setCurrentMuseumId(null);
    setError("");
    setCustomRadius("");
    if (mode === "museum") {
      handleMuseumSearch();
    }
  };

  const handleRadiusChange = (newRadius) => {
    setRadiusKm(newRadius);
    setCustomRadius(newRadius.toString());
    setMuseumPage(1);
    handleMuseumSearch(newRadius);
  };

  const handleCustomRadiusChange = (e) => {
    const value = e.target.value;
    setCustomRadius(value);
    const radius = parseFloat(value);
    if (!isNaN(radius) && radius >= 1 && radius <= 500) {
      setRadiusKm(radius);
      setMuseumPage(1);
      handleMuseumSearch(radius);
    }
  };

  useEffect(() => {
    const urlQuery = searchParams.get("q");
    const urlMode = searchParams.get("mode") || "title";
    const validMode = ["title", "artist"].includes(urlMode) ? urlMode : "title";
    const savedState = loadSearchResult();

    if (urlQuery?.trim()) {
      setQuery(urlQuery);
      setSearchMode(validMode);
      // Only perform search if no results or query/mode has changed
      const hasResults =
        (validMode === "title" && results.length > 0) ||
        (validMode === "artist" && artistResults.length > 0);
      const queryOrModeChanged =
        !savedState ||
        savedState.savedQuery !== urlQuery ||
        savedState.savedMode !== validMode;
      if (!hasResults || queryOrModeChanged) {
        clearSearchState();
        if (validMode === "artist") {
          handleArtistSearch(null, 0, urlQuery);
        } else {
          handleTitleSearch(null, 0, urlQuery);
        }
      }
    } else if (savedState) {
      if (
        savedState.savedViewMode === "museumArtworks" &&
        savedState.savedMuseumId
      ) {
        setAllMuseumArtworks(
          Array.isArray(savedState.savedAllMuseumArtworks)
            ? savedState.savedAllMuseumArtworks
            : []
        );
        setMuseumArtworks(
          Array.isArray(savedState.savedAllMuseumArtworks)
            ? savedState.savedAllMuseumArtworks.slice(
                (savedState.savedMuseumArtworksPage - 1) * pageSize,
                savedState.savedMuseumArtworksPage * pageSize
              )
            : []
        );
        setCurrentMuseumId(savedState.savedMuseumId);
        setMuseumArtworksPage(savedState.savedMuseumArtworksPage || 1);
        setViewMode("museumArtworks");
      } else if (savedState.savedQuery?.trim()) {
        if (savedState.savedMode === "artist") {
          handleArtistSearch(
            null,
            savedState.savedOffset,
            savedState.savedQuery
          );
        } else if (savedState.savedMode === "title") {
          handleTitleSearch(
            null,
            savedState.savedOffset,
            savedState.savedQuery
          );
        }
      } else if (savedState.savedMode === "museum") {
        setAllMuseumResults(
          Array.isArray(savedState.allMuseumResults)
            ? savedState.allMuseumResults
            : []
        );
        setMuseumResults(
          Array.isArray(savedState.allMuseumResults)
            ? savedState.allMuseumResults.slice(
                (savedState.savedMuseumPage - 1) * pageSize,
                savedState.savedMuseumPage * pageSize
              )
            : []
        );
        setMuseumPage(savedState.savedMuseumPage || 1);
        setRadiusKm(savedState.savedRadiusKm || 5);
        setCustomRadius(savedState.savedCustomRadius || "");
        setSearchMode("museum");
        setViewMode("main");
      }
    } else {
      fetchRecommendations(offset);
    }
  }, [navigate, searchParams]);

  return (
    <div className="container mt-5">
      <style>
        {`
          .btn-success:disabled {
            opacity: 1;
          }
          .radius-buttons {
            display: flex;
            gap: 0.5rem;
            margin: 1rem 0;
            flex-wrap: wrap;
          }
          .radius-button {
            padding: 0.5rem 1rem;
            border: 1px solid #007bff;
            border-radius: 0.25rem;
            background-color: #fff;
            color: #007bff;
            cursor: pointer;
            transition: all 0.2s;
          }
          .radius-button.active {
            background-color: #007bff;
            color: #fff;
          }
          .radius-button:hover:not(.active) {
            background-color: #e9ecef;
          }
          .radius-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          .custom-radius-input {
            width: 100px;
            padding: 0.5rem;
            border: 1px solid #ced4da;
            border-radius: 0.25rem;
            margin-left: 0.5rem;
          }
          .custom-radius-input:focus {
            border-color: #007bff;
            outline: none;
            box-shadow: 0 0 0 0.2rem rgba(0,123,255,0.25);
          }
          .map-container {
            height: 400px;
            width: 100%;
            margin-bottom: 1rem;
            border: 1px solid #dee2e6;
            border-radius: 0.25rem;
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
      </div>

      {/* Radius Buttons for Museum Search */}
      {searchMode === "museum" && viewMode === "main" && (
        <div className="mb-4">
          <h6>Select search radius (km):</h6>
          <div className="radius-buttons">
            {[5, 10, 25, 50, 100, 150].map((radius) => (
              <button
                key={radius}
                className={`radius-button ${
                  radiusKm === radius ? "active" : ""
                }`}
                onClick={() => handleRadiusChange(radius)}
                disabled={isSearchLoading}
              >
                {radius}
              </button>
            ))}
            <input
              type="number"
              className="custom-radius-input"
              placeholder="Custom"
              value={customRadius}
              onChange={handleCustomRadiusChange}
              min="1"
              max="500"
              step="1"
              disabled={isSearchLoading}
            />
          </div>
        </div>
      )}

      {/* Map for Nearby Museums */}
      {searchMode === "museum" && viewMode === "main" && userLocation && (
        <div className="map-container">
          <MapContainer
            center={[userLocation.lat, userLocation.lon]}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <MapBounds
              userLocation={userLocation}
              museums={allMuseumResults}
              radiusKm={radiusKm}
            />
            <SearchRadiusCircle
              userLocation={userLocation}
              radiusKm={radiusKm}
            />
            <Marker
              position={[userLocation.lat, userLocation.lon]}
              icon={redIcon}
            >
              <Popup>Your Location</Popup>
            </Marker>
            {allMuseumResults
              .filter((museum) => museum.latitude && museum.longitude)
              .map((museum) => (
                <Marker
                  key={museum.id}
                  position={[museum.latitude, museum.longitude]}
                >
                  <Popup>
                    <strong>{museum.name}</strong>
                    <br />
                    Distance: {museum.distance_km?.toFixed(2)} km
                    <br />
                    <button
                      className="btn btn-primary btn-sm mt-2"
                      onClick={() => handleViewMuseum(museum.id)}
                    >
                      View Museum
                    </button>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        </div>
      )}

      {/* Artist Info */}
      {artistInfo && viewMode === "main" && (
        <div className="mb-4">
          <h4>Artist: {artistInfo.label}</h4>
          <p>{artistInfo?.description || "No description available."}</p>
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

      {/* Results, Museum Artworks, or Recommendations */}
      {viewMode === "museumArtworks" ? (
        <>
          <h4>Museum Artworks</h4>
          <button
            className="btn btn-secondary mb-4"
            onClick={handleBackToMuseums}
          >
            Back to Museums
          </button>
          {isSearchLoading ? (
            <div className="text-center">
              <div className="spinner-border text-success" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p>Loading museum artworks...</p>
            </div>
          ) : (
            <>
              <div className="row">
                {museumArtworks.map((item, index) =>
                  renderCard(item, index, "artwork")
                )}
              </div>
              <div className="d-flex justify-content-between">
                <button
                  className="btn btn-secondary"
                  onClick={() => handleMuseumArtworksPagination("prev")}
                  disabled={museumArtworksPage === 1 || isSearchLoading}
                >
                  Previous
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleMuseumArtworksPagination("next")}
                  disabled={
                    museumArtworksPage * pageSize >= allMuseumArtworks.length ||
                    isSearchLoading
                  }
                >
                  Next
                </button>
              </div>
            </>
          )}
        </>
      ) : results.length > 0 ||
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
                    searchMode === "museum" ? "museum" : "artwork"
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
                    (searchMode === "museum" ? museumPage : searchPage) === 1 ||
                    isSearchLoading
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
                      ? museumPage * pageSize >= allMuseumResults.length
                      : searchMode === "artist"
                      ? artistResults.length < pageSize
                      : results.length < pageSize) || isSearchLoading
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
                  renderCard(item, index, "artwork")
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
