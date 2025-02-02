import React, { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const Contact = () => {
  useEffect(() => {
    const defaultIcon = L.icon({
      iconUrl: markerIcon,
      shadowUrl: markerShadow,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    const map = L.map("mapid").setView([43.271567, -2.940144], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
    }).addTo(map);

    L.marker([43.271567, -2.940144], { icon: defaultIcon })
      .addTo(map)
      .bindPopup("<b>Musaica</b><br>Location.")
      .openPopup();

    map.scrollWheelZoom.disable();
    map.touchZoom.disable();

    return () => {
      map.remove();
    };
  }, []);

  return (
    <>
      <div className="container-fluid bg-light py-5">
        <div className="col-md-6 m-auto text-center">
          <h1 className="h1">Contact Us</h1>
          <p>
            If you have any questions or want to learn more about how Musaica
            can support your art collection management, we’d love to hear from
            you. Our dedicated team is here to provide assistance, schedule a
            demo, or discuss partnership opportunities. Reach out today and
            let’s collaborate to preserve and celebrate art together!
          </p>
        </div>
      </div>
      <div
        id="mapid"
        style={{ width: "100%", height: "300px", marginBottom: "20px" }}
      ></div>
      <div className="container py-5">
        <div className="row py-5">
          <form
            className="col-md-9 m-auto"
            method="POST"
            action="https://formspree.io/f/myzzblyv"
          >
            <div className="row">
              <div className="form-group col-md-6 mb-3">
                <label htmlFor="name">Name</label>
                <input
                  type="text"
                  className="form-control mt-1"
                  id="name"
                  name="name"
                  placeholder="Name"
                  required
                />
              </div>
              <div className="form-group col-md-6 mb-3">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  className="form-control mt-1"
                  id="email"
                  name="email"
                  placeholder="Email"
                  required
                />
              </div>
            </div>
            <div className="mb-3">
              <label htmlFor="subject">Subject</label>
              <input
                type="text"
                className="form-control mt-1"
                id="subject"
                name="subject"
                placeholder="Subject"
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="message">Message</label>
              <textarea
                className="form-control mt-1"
                id="message"
                name="message"
                placeholder="Message"
                rows="8"
                required
              ></textarea>
            </div>
            <div className="row">
              <div className="col text-end mt-2">
                <button type="submit" className="btn btn-success btn-lg px-3">
                  Let’s Talk
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default Contact;
