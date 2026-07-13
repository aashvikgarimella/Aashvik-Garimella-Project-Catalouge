import cv2  # OpenCV library for image processing
import numpy as np  # NumPy for numerical operations

class ObjectDetector:
    def __init__(self):
        # Default size for processing windows - can be adjusted based on expected object size
        self.window_size = (64, 64)
        
    def preprocess_image(self, image):
        """
        Prepare images for matching by converting to grayscale and enhancing features.
        This makes matching more reliable by standardizing the images.
        
        Args:
            image: Input image (can be either BGR or grayscale)
        Returns:
            Preprocessed grayscale image
        """
        # Convert color images to grayscale if needed
        # Grayscale is used because we're matching patterns, not colors
        if len(image.shape) > 2:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()
        
        # Apply Gaussian blur to reduce noise
        # The (5,5) kernel size provides moderate smoothing
        gray = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Equalize histogram to improve contrast
        # This helps make matching work better across different lighting conditions
        gray = cv2.equalizeHist(gray)
        
        return gray

    def find_matches(self, search_img, template_img, threshold=0.2):
        """
        Find all potential matches of template_img within search_img.
        
        Args:
            search_img: Large image to search within
            template_img: Small image to find
            threshold: Minimum confidence score (0.0 to 1.0) for a match
        
        Returns:
            List of tuples (x, y, width, height, confidence) for each match
        """
        # Step 1: Preprocess both images to make them more comparable
        processed_search = self.preprocess_image(search_img)
        processed_template = self.preprocess_image(template_img)
        
        # List to store all matches found
        matches = []
        
        # Step 2: Try different scales to find objects of different sizes
        # Scale range from 0.2 (20% of original size) to 1.5 (150% of original size)
        for scale in np.linspace(0.2, 1.5, 20):  # 20 different scales
            # Resize template image according to current scale
            resized_template = cv2.resize(processed_template, 
                                        (int(template_img.shape[1] * scale),
                                         int(template_img.shape[0] * scale)))
            
            # Skip if resized template is larger than search image
            if resized_template.shape[0] > search_img.shape[0] or \
               resized_template.shape[1] > search_img.shape[1]:
                continue
            
            # Step 3: Perform template matching
            # TM_CCOEFF_NORMED provides a correlation coefficient between -1 and 1
            # 1 indicates perfect match, -1 indicates perfect negative match
            result = cv2.matchTemplate(processed_search, resized_template, 
                                     cv2.TM_CCOEFF_NORMED)
            
            # Find all locations where match quality is above threshold
            locations = np.where(result >= threshold)
            
            # Step 4: Store all matches found at this scale
            for pt in zip(*locations[::-1]):  # [::-1] to swap x,y coordinates
                matches.append((
                    pt[0],  # x coordinate
                    pt[1],  # y coordinate
                    int(template_img.shape[1] * scale),  # width
                    int(template_img.shape[0] * scale),  # height
                    result[pt[1], pt[0]]  # confidence score
                ))
        
        # Sort matches by confidence score, highest first
        matches.sort(key=lambda x: x[4], reverse=True)
        return matches

def main():
    """
    Main function to load images, find matches, and display results.
    """
    # Step 1: Load the images
    # Note: template is the small image we're looking for
    #       search is the larger image we're looking in
    template_img = cv2.imread('wanted_man.png')      
    search_img = cv2.imread('searchPlace.jpg')       
    
    # Check if images loaded successfully
    if search_img is None:
        print("Error: Could not load search image 'searchPlace.jpg'")
        return
    if template_img is None:
        print("Error: Could not load template image 'wanted_man.png'")
        return
        
    # Print image dimensions for debugging
    print(f"Search image size: {search_img.shape}")
    print(f"Template image size: {template_img.shape}")
    
    # Step 2: Create detector and find matches
    detector = ObjectDetector()
    matches = detector.find_matches(search_img, template_img, threshold=0.2)
    
    # Step 3: Prepare output visualization
    result = search_img.copy()
    
    # Step 4: Draw top 5 matches (or fewer if less than 5 found)
    for i, (x, y, w, h, conf) in enumerate(matches[:5]):
        # Use different shades of green for each match
        color = (0, 255 - i*40, 0)
        
        # Draw rectangle around match
        cv2.rectangle(result, (x, y), (x+w, y+h), color, 2)
        
        # Draw circle at center of match
        center_x = x + w//2
        center_y = y + h//2
        radius = int(max(w, h) / 3)
        cv2.circle(result, (center_x, center_y), radius, (0, 0, 255), 2)
        
        # Add confidence score text
        score_text = f'Match {i+1}: {conf:.2%}'
        cv2.putText(result, score_text, (x, y-10), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)
    
    # Add total matches found text
    cv2.putText(result, f'Found {len(matches)} potential matches', (10, 30), 
               cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    
    # Step 5: Display results
    cv2.imshow('Template (Object to find)', template_img)
    cv2.imshow('Search Image', search_img)
    cv2.imshow('Matches Found', result)
    
    # Wait for any key press
    print("Press any key to close the windows...")
    cv2.waitKey(0)
    
    # Clean up
    cv2.destroyAllWindows()

# Only run the main function if this script is run directly
if __name__ == "__main__":
    main()