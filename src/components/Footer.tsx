import '../styles/components/Footer.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <h3>About Us</h3>
            <p>Luxury Hotel - Your destination for comfort and elegance</p>
          </div>
          <div className="footer-section">
            <h3>Quick Links</h3>
            <ul>
              <li>
                <a href="/">Home</a>
              </li>
              <li>
                <a href="/rooms">Rooms</a>
              </li>
              <li>
                <a href="/about">About</a>
              </li>
              <li>
                <a href="/contact">Contact</a>
              </li>
            </ul>
          </div>
          <div className="footer-section">
            <h3>Follow Us</h3>
            <div className="social-links">
              <a href="#facebook">Facebook</a>
              <a href="#twitter">Twitter</a>
              <a href="#instagram">Instagram</a>
              <a href="#linkedin">LinkedIn</a>
            </div>
          </div>
          <div className="footer-section">
            <h3>Contact</h3>
            <p>📞 +1 (555) 123-4567</p>
            <p>📧 info@luxuryhotel.com</p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {currentYear} Luxury Hotel. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
