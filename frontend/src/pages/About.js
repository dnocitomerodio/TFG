import React from "react";

const About = () => {
  return (
    <>
      {/* Hero Section */}
      <section className="bg-success py-5">
        <div className="container">
          <div className="row align-items-center py-5">
            <div className="col-md-8 text-white">
              <h1>About Musaica</h1>
              <p>
                <strong>Musaica</strong> is your go-to platform for tracking and
                exploring art collections. Designed for enthusiasts, collectors,
                and professionals, our app lets you build a personal{" "}
                <strong>Collection</strong>, discover nearby artworks, and enjoy
                AI-powered insights tailored to your tastes. Start adding
                artworks or searching for inspiration today.
              </p>
            </div>
            <div className="col-md-4">
              <img
                src="/assets/img/about-hero.svg"
                alt="About Hero"
                className="img-fluid"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container py-5">
        <div className="row text-center pt-5 pb-3">
          <div className="col-lg-6 m-auto">
            <h1 className="h1">Our Features</h1>
            <p>
              <strong>Musaica</strong> offers intuitive tools to help you manage
              your art collection, discover new pieces, and gain personalized
              insights with ease.
            </p>
          </div>
        </div>
        <div className="row">
          <div className="col-md-6 col-lg-3 pb-5">
            <div className="h-100 py-5 services-icon-wap shadow">
              <div className="h1 text-success text-center">
                <i className="fa fa-list"></i>
              </div>
              <h2 className="h5 mt-4 text-center">Collection Tracking</h2>
              <p className="text-center px-3">
                Add artworks to your <strong>Collection</strong> and set a
                mobility area in your profile to get alerts when they’re nearby.
              </p>
            </div>
          </div>
          <div className="col-md-6 col-lg-3 pb-5">
            <div className="h-100 py-5 services-icon-wap shadow">
              <div className="h1 text-success text-center">
                <i className="fa fa-brain"></i>
              </div>
              <h2 className="h5 mt-4 text-center">AI-Powered Insights</h2>
              <p className="text-center px-3">
                Request custom AI-generated descriptions for artworks to deepen
                your understanding.
              </p>
            </div>
          </div>
          <div className="col-md-6 col-lg-3 pb-5">
            <div className="h-100 py-5 services-icon-wap shadow">
              <div className="h1 text-success text-center">
                <i className="fa fa-thumbs-up"></i>
              </div>
              <h2 className="h5 mt-4 text-center">Art Recommendations</h2>
              <p className="text-center px-3">
                Set preferences in your profile to receive personalized artwork
                suggestions.
              </p>
            </div>
          </div>
          <div className="col-md-6 col-lg-3 pb-5">
            <div className="h-100 py-5 services-icon-wap shadow">
              <div className="h1 text-success text-center">
                <i className="fa fa-map-marker-alt"></i>
              </div>
              <h2 className="h5 mt-4 text-center">Nearby Art Discovery</h2>
              <p className="text-center px-3">
                Use the <strong>Search</strong> bar to find artworks by title or
                artist near your location.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="bg-light py-5">
        <div className="container">
          <div className="row text-center py-3">
            <div className="col-lg-8 m-auto">
              <h1 className="h1">Our Mission</h1>
              <p>
                At <strong>Musaica</strong>, we’re passionate about making art
                accessible and personal. Our goal is to empower art lovers
                worldwide to track their collections, discover new masterpieces,
                and connect with art in meaningful ways using innovative AI and
                location-based tools.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container py-5">
        <div className="row text-center pt-5 pb-3">
          <div className="col-lg-6 m-auto">
            <h1 className="h1">How It Works</h1>
            <p>
              Getting started with <strong>Musaica</strong> is simple. Follow
              these steps to manage and explore art like never before.
            </p>
          </div>
        </div>
        <div className="row">
          <div className="col-md-4 pb-5">
            <div className="h-100 py-5 services-icon-wap shadow">
              <div className="h1 text-success text-center">
                <i className="fa fa-plus-circle"></i>
              </div>
              <h2 className="h5 mt-4 text-center">1. Build Your Collection</h2>
              <p className="text-center px-3">
                Visit the <strong>Collection</strong> page to add artworks you
                own or love. Set your mobility area in your profile for
                location-based alerts.
              </p>
            </div>
          </div>
          <div className="col-md-4 pb-5">
            <div className="h-100 py-5 services-icon-wap shadow">
              <div className="h1 text-success text-center">
                <i className="fa fa-search"></i>
              </div>
              <h2 className="h5 mt-4 text-center">2. Explore Art</h2>
              <p className="text-center px-3">
                Use the <strong>Search</strong> bar to find artworks by title or
                artist, or discover pieces near your location.
              </p>
            </div>
          </div>
          <div className="col-md-4 pb-5">
            <div className="h-100 py-5 services-icon-wap shadow">
              <div className="h1 text-success text-center">
                <i className="fa fa-cog"></i>
              </div>
              <h2 className="h5 mt-4 text-center">
                3. Personalize Your Experience
              </h2>
              <p className="text-center px-3">
                Request AI-generated descriptions and set preferences in your
                profile to get tailored recommendations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Data Source Section */}
      <section className="bg-success py-5">
        <div className="container">
          <div className="row align-items-center py-5">
            <div className="col-md-8 text-white">
              <h1>Powered by Wikidata</h1>
              <p>
                <strong>Musaica</strong> leverages <strong>Wikidata</strong>’s
                extensive, community-driven database to provide accurate and
                rich information about artworks. From artist details to
                historical context, our app connects you to a world of art
                knowledge, ensuring your collection and searches are informed by
                reliable data.
              </p>
            </div>
            <div className="col-md-4">
              <img
                src="/assets/img/wikidata_logo.png"
                alt="Wikidata Logo"
                className="img-fluid w-50 mx-auto d-block"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default About;
