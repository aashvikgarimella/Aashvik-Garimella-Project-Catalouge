import cv2
import numpy as np

class ObjectDetector:
    def __init__(self):
        self.window_size = (64, 64)
        
    def gaussian_blur(self, image, kernel_size=5):
        """
        Apply Gaussian blur to reduce noise
        Shows the explicit blurring step required
        """
        return cv2.GaussianBlur(image, (kernel_size, kernel_size), 0)
    
    def detect_edges(self, image):
        """
        Detect edges using Canny edge detector
        Part of the required edge detection step
        """
        if len(image.shape) > 2:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        edges = cv2.Canny(gray, 50, 150)
        return edges
    
    def find_contours(self, edge_image):
        """
        Find contours in edge image
        Required contour detection step
        """
        contours, _ = cv2.findContours(edge_image, 
                                     cv2.RETR_EXTERNAL, 
                                     cv2.CHAIN_APPROX_SIMPLE)
        return contours

    def detect_circles(self, image):
        """
        Detect circles using Hough Circle Transform
        Required circle detection step
        """
        if len(image.shape) > 2:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
            
        circles = cv2.HoughCircles(gray, 
                                 cv2.HOUGH_GRADIENT, 
                                 dp=1, 
                                 minDist=20,
                                 param1=50,
                                 param2=30,
                                 minRadius=10,
                                 maxRadius=100)
        return circles

    def compute_hog(self, image):
        """
        Compute HOG features for the image
        """
        if len(image.shape) > 2:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()
        
        # Resize image (part of the required RESIZE step)
        gray = cv2.resize(gray, self.window_size)
        
        # Calculate gradients
        gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=1)
        gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=1)
        
        magnitude = np.sqrt(gx**2 + gy**2)
        orientation = np.arctan2(gy, gx) * 180 / np.pi % 180
        
        cell_size = 16
        num_bins = 9
        
        cell_hist = []
        for y in range(0, gray.shape[0], cell_size):
            for x in range(0, gray.shape[1], cell_size):
                mag_cell = magnitude[y:min(y+cell_size, gray.shape[0]), 
                                  x:min(x+cell_size, gray.shape[1])]
                ori_cell = orientation[y:min(y+cell_size, gray.shape[0]), 
                                    x:min(x+cell_size, gray.shape[1])]
                
                hist = np.zeros(num_bins)
                bin_idx = (ori_cell / 20).astype(int)
                for i in range(num_bins):
                    hist[i] = np.sum(mag_cell[bin_idx == i])
                
                cell_hist.extend(hist)
        
        return np.array(cell_hist)

    def find_best_match(self, search_img, template_img, threshold=0.5):
        """
        Find best match using combination of HOG and classical computer vision
        """
        # Initialize dictionary to store all intermediate results
        results = {}
        
        print("1. Applying Gaussian Blur...")
        # Blur both images
        search_blurred = self.gaussian_blur(search_img)
        template_blurred = self.gaussian_blur(template_img)
        results['blurred'] = search_blurred
        
        print("2. Detecting Edges...")
        # Edge detection
        search_edges = self.detect_edges(search_blurred)
        template_edges = self.detect_edges(template_blurred)
        results['edges'] = search_edges
        
        print("3. Finding Contours...")
        # Contour detection
        search_contours = self.find_contours(search_edges)
        template_contours = self.find_contours(template_edges)
        results['contours'] = search_contours
        
        print("4. Detecting Circles...")
        # Circle detection
        circles = self.detect_circles(search_blurred)
        results['circles'] = circles
        
        print("5. Computing HOG features...")
        # Get template HOG features
        template_features = self.compute_hog(template_img)
        
        # Track best match
        best_match = None
        best_score = threshold
        
        print("6. Searching for matches...")
        # Try different scales
        for scale in np.linspace(0.5, 1.5, 8):
            # RESIZE step - scale the search image
            width = int(search_img.shape[1] * scale)
            height = int(search_img.shape[0] * scale)
            scaled_img = cv2.resize(search_img, (width, height))
            
            step_size = 16
            for y in range(0, height - self.window_size[1], step_size):
                for x in range(0, width - self.window_size[0], step_size):
                    window = scaled_img[y:y+self.window_size[1], 
                                     x:x+self.window_size[0]]
                    
                    if window.shape[:2] != self.window_size:
                        continue
                    
                    # Compute HOG features for window
                    window_features = self.compute_hog(window)
                    
                    # Calculate HOG similarity
                    score = np.dot(template_features, window_features) / (
                        np.linalg.norm(template_features) * np.linalg.norm(window_features))
                    
                    if score > best_score:
                        best_score = score
                        best_match = (
                            int(x / scale),
                            int(y / scale),
                            int(self.window_size[0] / scale),
                            int(self.window_size[1] / scale),
                            score
                        )
        
        return best_match, results

def main():
    print("Loading images...")
    template_img = cv2.imread('wanted_man1.png')
    search_img = cv2.imread('searchPlace.jpg')
    
    if search_img is None or template_img is None:
        print("Error loading images!")
        return
        
    print(f"Search image size: {search_img.shape}")
    print(f"Template size: {template_img.shape}")
    
    detector = ObjectDetector()
    match, intermediate_results = detector.find_best_match(search_img, template_img)
    
    # Show all intermediate steps
    cv2.imshow('1. Original Template', template_img)
    cv2.imshow('2. Gaussian Blur', intermediate_results['blurred'])
    cv2.imshow('3. Edge Detection', intermediate_results['edges'])
    
    # Show contours
    contour_img = np.zeros_like(search_img)
    cv2.drawContours(contour_img, intermediate_results['contours'], -1, (0, 255, 0), 2)
    cv2.imshow('4. Contours', contour_img)
    
    # Show circles
    circle_img = search_img.copy()
    if intermediate_results['circles'] is not None:
        circles = intermediate_results['circles'][0]
        for circle in circles:
            x, y, r = circle
            cv2.circle(circle_img, (int(x), int(y)), int(r), (255, 0, 0), 2)
    cv2.imshow('5. Circle Detection', circle_img)
    
    # Show final result
    result = search_img.copy()
    if match is not None:
        x, y, w, h, confidence = match
        cv2.rectangle(result, (x, y), (x+w, y+h), (0, 255, 0), 2)
        cv2.putText(result, f"Match: {confidence:.2%}", (x, y-10),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
    else:
        cv2.putText(result, "No match found!", (10, 30),
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
    
    cv2.imshow('6. Final Result', result)
    
    print("Press any key to exit...")
    cv2.waitKey(0)
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()