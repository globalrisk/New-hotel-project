import '../styles/pages/About.css';

export default function About() {
  return (
    <div className="about">
      <div className="about-header">
        <h1>About Luxury Hotel</h1>
        <p>Our Story and Values</p>
      </div>

      <div className="container">
        {/* Our Story */}
        <section className="about-section">
          <h2>Our Story</h2>
          <p>
            Founded in 2000, Luxury Hotel has been a beacon of hospitality and excellence for over two decades.
            What started as a small boutique hotel has grown into one of the most prestigious hospitality brands
            in the region, known for its commitment to exceptional service and luxurious comfort.
          </p>
        </section>

        {/* Mission */}
        <section className="about-section">
          <h2>Our Mission</h2>
          <p>
            To provide world-class hospitality and create unforgettable experiences for our guests.
            We believe in delivering exceptional service that goes beyond expectations, ensuring
            every guest feels valued and cared for during their stay.
          </p>
        </section>

        {/* Core Values */}
        <section className="about-section">
          <h2>Our Core Values</h2>
          <div className="values-grid">
            <div className="value-card">
              <h3>Excellence</h3>
              <p>We strive for excellence in every aspect of our service</p>
            </div>
            <div className="value-card">
              <h3>Integrity</h3>
              <p>We conduct business with honesty and transparency</p>
            </div>
            <div className="value-card">
              <h3>Innovation</h3>
              <p>We embrace new ideas to enhance guest experiences</p>
            </div>
            <div className="value-card">
              <h3>Community</h3>
              <p>We are committed to giving back to our community</p>
            </div>
          </div>
        </section>

        {/* Team */}
        <section className="about-section">
          <h2>Our Team</h2>
          <p>
            Our dedicated team of hospitality professionals is committed to making your stay
            memorable. With years of experience and passion for service, our staff is always
            ready to assist you with any request.
          </p>
          <div className="team-grid">
            <div className="team-member">
              <img src="https://via.placeholder.com/200x200?text=Manager" alt="General Manager" />
              <h3>John Smith</h3>
              <p>General Manager</p>
            </div>
            <div className="team-member">
              <img src="https://via.placeholder.com/200x200?text=Chef" alt="Executive Chef" />
              <h3>Maria Garcia</h3>
              <p>Executive Chef</p>
            </div>
            <div className="team-member">
              <img src="https://via.placeholder.com/200x200?text=Operations" alt="Operations Manager" />
              <h3>Ahmed Hassan</h3>
              <p>Operations Manager</p>
            </div>
          </div>
        </section>

        {/* Awards */}
        <section className="about-section">
          <h2>Awards & Recognition</h2>
          <ul className="awards-list">
            <li>🏆 Best Hotel Award 2023</li>
            <li>⭐ TripAdvisor Excellence Award 2023</li>
            <li>🌟 Five-Star Rating (2020-2024)</li>
            <li>🎖️ Customer Service Excellence Award 2022</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
