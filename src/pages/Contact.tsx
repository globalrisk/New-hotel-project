import { useState } from 'react';
import '../styles/pages/Contact.css';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });

  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    setSubmitted(true);
    setFormData({
      name: '',
      email: '',
      phone: '',
      subject: '',
      message: '',
    });
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <div className="contact">
      <div className="contact-header">
        <h1>Contact Us</h1>
        <p>We would love to hear from you</p>
      </div>

      <div className="container">
        <div className="contact-wrapper">
          {/* Contact Form */}
          <div className="contact-form-section">
            <h2>Send us a Message</h2>
            {submitted && <div className="success-message">✓ Message sent successfully!</div>}
            <form onSubmit={handleSubmit} className="contact-form">
              <div className="form-group">
                <label htmlFor="name">Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Your name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="Your email"
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Your phone number"
                />
              </div>

              <div className="form-group">
                <label htmlFor="subject">Subject *</label>
                <select
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select a subject</option>
                  <option value="booking">Booking Inquiry</option>
                  <option value="feedback">Feedback</option>
                  <option value="support">Support</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="message">Message *</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  placeholder="Your message"
                  rows={5}
                />
              </div>

              <button type="submit" className="btn btn-primary">
                Send Message
              </button>
            </form>
          </div>

          {/* Contact Information */}
          <div className="contact-info-section">
            <h2>Contact Information</h2>

            <div className="info-item">
              <h3>📍 Address</h3>
              <p>123 Luxury Street</p>
              <p>City Center, State 12345</p>
              <p>Country</p>
            </div>

            <div className="info-item">
              <h3>📞 Phone</h3>
              <p>Main: +1 (555) 123-4567</p>
              <p>Reservations: +1 (555) 123-4568</p>
              <p>Support: +1 (555) 123-4569</p>
            </div>

            <div className="info-item">
              <h3>📧 Email</h3>
              <p>
                <a href="mailto:info@luxuryhotel.com">info@luxuryhotel.com</a>
              </p>
              <p>
                <a href="mailto:reservations@luxuryhotel.com">reservations@luxuryhotel.com</a>
              </p>
            </div>

            <div className="info-item">
              <h3>🕒 Hours</h3>
              <p>Monday - Friday: 8:00 AM - 10:00 PM</p>
              <p>Saturday - Sunday: 9:00 AM - 11:00 PM</p>
              <p>24/7 Emergency Support</p>
            </div>

            {/* Map Placeholder */}
            <div className="map-container">
              <iframe
                title="Hotel Location"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3153.835434509374!2d-122.4194155!3d37.7749295!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x80858064cce67e51%3A0x2d86c1790784c59d!2sSan%20Francisco%2C%20CA!5e0!3m2!1sen!2sus!4v1234567890"
                width="100%"
                height="300"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
