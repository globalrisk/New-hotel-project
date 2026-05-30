import { useState } from 'react';
import '../styles/pages/Gallery.css';

interface GalleryImage {
  id: number;
  title: string;
  category: string;
  image: string;
}

const images: GalleryImage[] = [
  { id: 1, title: 'Lobby', category: 'Public Areas', image: 'https://via.placeholder.com/400x300?text=Lobby' },
  { id: 2, title: 'Bedroom', category: 'Rooms', image: 'https://via.placeholder.com/400x300?text=Bedroom' },
  { id: 3, title: 'Restaurant', category: 'Dining', image: 'https://via.placeholder.com/400x300?text=Restaurant' },
  { id: 4, title: 'Swimming Pool', category: 'Amenities', image: 'https://via.placeholder.com/400x300?text=Pool' },
  { id: 5, title: 'Spa', category: 'Amenities', image: 'https://via.placeholder.com/400x300?text=Spa' },
  { id: 6, title: 'Meeting Room', category: 'Public Areas', image: 'https://via.placeholder.com/400x300?text=Meeting' },
  { id: 7, title: 'Deluxe Suite', category: 'Rooms', image: 'https://via.placeholder.com/400x300?text=Suite' },
  { id: 8, title: 'Garden', category: 'Outdoor', image: 'https://via.placeholder.com/400x300?text=Garden' },
];

const categories = ['All', 'Rooms', 'Public Areas', 'Dining', 'Amenities', 'Outdoor'];

export default function Gallery() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);

  const filteredImages = selectedCategory === 'All' ? images : images.filter((img) => img.category === selectedCategory);

  return (
    <div className="gallery">
      <div className="gallery-header">
        <h1>Photo Gallery</h1>
        <p>Explore the beauty and elegance of our hotel</p>
      </div>

      <div className="container">
        {/* Filter Buttons */}
        <div className="gallery-filters">
          {categories.map((category) => (
            <button
              key={category}
              className={`filter-btn ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Gallery Grid */}
        <div className="gallery-grid">
          {filteredImages.map((image) => (
            <div
              key={image.id}
              className="gallery-item"
              onClick={() => setSelectedImage(image)}
            >
              <img src={image.image} alt={image.title} />
              <div className="gallery-overlay">
                <p>{image.title}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Lightbox */}
        {selectedImage && (
          <div className="lightbox" onClick={() => setSelectedImage(null)}>
            <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
              <button className="close-btn" onClick={() => setSelectedImage(null)}>
                ✕
              </button>
              <img src={selectedImage.image} alt={selectedImage.title} />
              <p>{selectedImage.title}</p>
              <span>{selectedImage.category}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
