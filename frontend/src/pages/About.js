import React from "react";

const About = () => {
  return (
    <>
      <section className="bg-success py-5">
        <div className="container">
          <div className="row align-items-center py-5">
            <div className="col-md-8 text-white">
              <h1>About Us</h1>
              <p>
                At Musaica, we blend our passion for art with cutting-edge
                technology to deliver a comprehensive solution for managing
                collections. Our RESTful API is designed to optimize the
                administration of artwork in museums and private collections,
                enabling you to catalog, track, and share your pieces
                efficiently and securely.
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
      <section className="container py-5">
        <div className="row text-center pt-5 pb-3">
          <div className="col-lg-6 m-auto">
            <h1 className="h1">Our Services</h1>
            <p>
              We provide a comprehensive set of tools and features that empower
              institutions and collectors to manage their art collections
              efficiently.
            </p>
          </div>
        </div>
        <div className="row">
          <div className="col-md-6 col-lg-3 pb-5">
            <div className="h-100 py-5 services-icon-wap shadow">
              <div className="h1 text-success text-center">
                <i className="fa fa-archive"></i>
              </div>
              <h2 className="h5 mt-4 text-center">Artwork Cataloging</h2>
            </div>
          </div>
          <div className="col-md-6 col-lg-3 pb-5">
            <div className="h-100 py-5 services-icon-wap shadow">
              <div className="h1 text-success text-center">
                <i className="fa fa-file"></i>
              </div>
              <h2 className="h5 mt-4 text-center">Collection Management</h2>
            </div>
          </div>
          <div className="col-md-6 col-lg-3 pb-5">
            <div className="h-100 py-5 services-icon-wap shadow">
              <div className="h1 text-success text-center">
                <i className="fa fa-share"></i>
              </div>
              <h2 className="h5 mt-4 text-center">Secure Sharing</h2>
            </div>
          </div>
          <div className="col-md-6 col-lg-3 pb-5">
            <div className="h-100 py-5 services-icon-wap shadow">
              <div className="h1 text-success text-center">
                <i className="fa fa-university"></i>
              </div>
              <h2 className="h5 mt-4 text-center">Preservation & Research</h2>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default About;
