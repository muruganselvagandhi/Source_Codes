import cv2
import numpy as np

def get_leaf_masks(image):
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    green_mask = cv2.inRange(hsv, np.array([35, 50, 50]), np.array([85, 255, 255]))
    yellow_mask = cv2.inRange(hsv, np.array([20, 50, 50]), np.array([35, 255, 255]))
    kernel = np.ones((5, 5), np.uint8)
    green_mask = cv2.morphologyEx(green_mask, cv2.MORPH_CLOSE, kernel)
    yellow_mask = cv2.morphologyEx(yellow_mask, cv2.MORPH_CLOSE, kernel)
    return green_mask, yellow_mask

def is_leaf_shape(cnt, min_area=500, max_area=80000):
    area = cv2.contourArea(cnt)
    if area < min_area or area > max_area:
        print(f"Rejected contour (area={area})")
        return False

    x, y, w, h = cv2.boundingRect(cnt)
    aspect_ratio = w / float(h)
    if not (0.4 < aspect_ratio < 3.0):
        print(f"Rejected contour (aspect_ratio={aspect_ratio:.2f})")
        return False

    hull = cv2.convexHull(cnt)
    hull_area = cv2.contourArea(hull)
    solidity = float(area) / hull_area if hull_area > 0 else 0
    if solidity < 0.8:
        print(f"Rejected contour (solidity={solidity:.2f})")
        return False

    perimeter = cv2.arcLength(cnt, True)
    circularity = 4 * np.pi * area / (perimeter ** 2) if perimeter > 0 else 0
    if circularity < 0.1:
        print(f"Rejected contour (circularity={circularity:.2f})")
        return False

    return True

def filter_leaf_contours(green_mask, yellow_mask, image):
    combined_mask = cv2.bitwise_or(green_mask, yellow_mask)
    contours, _ = cv2.findContours(combined_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    green_contours = []
    yellow_contours = []

    for cnt in contours:
        if not is_leaf_shape(cnt):
            continue

        x, y, w, h = cv2.boundingRect(cnt)

        roi_gray = gray[y:y + h, x:x + w]
        lap_var = cv2.Laplacian(roi_gray, cv2.CV_64F).var()
        if lap_var < 10:  # relaxed from 30
            print(f"Rejected contour (low texture: lap_var={lap_var:.2f})")
            continue

        roi_hsv = hsv[y:y + h, x:x + w]
        hue = roi_hsv[:, :, 0]
        if np.std(hue) < 5:  # relaxed from 10
            print(f"Rejected contour (low hue std: {np.std(hue):.2f})")
            continue

        mask_roi = np.zeros_like(green_mask)
        cv2.drawContours(mask_roi, [cnt], -1, 255, -1)

        green_count = cv2.countNonZero(cv2.bitwise_and(green_mask, green_mask, mask=mask_roi))
        yellow_count = cv2.countNonZero(cv2.bitwise_and(yellow_mask, yellow_mask, mask=mask_roi))

        print(f"Contour: green_count={green_count}, yellow_count={yellow_count}")

        if green_count > yellow_count:
            green_contours.append(cnt)
        else:
            yellow_contours.append(cnt)

    return green_contours, yellow_contours

def main():
    cap = cv2.VideoCapture('http://192.168.208.70:8080/video')

    if not cap.isOpened():
        print("❌ Could not open video stream. Check the URL or network.")
        return

    while True:
        ret, frame = cap.read()
        if not ret:
            print("❌ Failed to grab frame")
            break

        frame = cv2.resize(frame, (640, 480))
        green_mask, yellow_mask = get_leaf_masks(frame)
        green_contours, yellow_contours = filter_leaf_contours(green_mask, yellow_mask, frame)

        output = frame.copy()
        cv2.drawContours(output, green_contours, -1, (0, 255, 0), 3)
        cv2.drawContours(output, yellow_contours, -1, (0, 0, 255), 3)

        print(f"✅ Green contours: {len(green_contours)} | Red contours: {len(yellow_contours)}")

        cv2.imshow("Green Mask", green_mask)
        cv2.imshow("Yellow Mask", yellow_mask)
        cv2.imshow("📸 Leaf Health Detection", output)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
import cv2
import numpy as np

def get_leaf_masks(image):
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    green_mask = cv2.inRange(hsv, np.array([35, 50, 50]), np.array([85, 255, 255]))
    yellow_mask = cv2.inRange(hsv, np.array([20, 50, 50]), np.array([35, 255, 255]))
    kernel = np.ones((5, 5), np.uint8)
    green_mask = cv2.morphologyEx(green_mask, cv2.MORPH_CLOSE, kernel)
    yellow_mask = cv2.morphologyEx(yellow_mask, cv2.MORPH_CLOSE, kernel)
    return green_mask, yellow_mask

def is_leaf_shape(cnt, min_area=500, max_area=80000):
    area = cv2.contourArea(cnt)
    if area < min_area or area > max_area:
        print(f"Rejected contour (area={area})")
        return False

    x, y, w, h = cv2.boundingRect(cnt)
    aspect_ratio = w / float(h)
    if not (0.4 < aspect_ratio < 3.0):
        print(f"Rejected contour (aspect_ratio={aspect_ratio:.2f})")
        return False

    hull = cv2.convexHull(cnt)
    hull_area = cv2.contourArea(hull)
    solidity = float(area) / hull_area if hull_area > 0 else 0
    if solidity < 0.8:
        print(f"Rejected contour (solidity={solidity:.2f})")
        return False

    perimeter = cv2.arcLength(cnt, True)
    circularity = 4 * np.pi * area / (perimeter ** 2) if perimeter > 0 else 0
    if circularity < 0.1:
        print(f"Rejected contour (circularity={circularity:.2f})")
        return False

    return True

def filter_leaf_contours(green_mask, yellow_mask, image):
    combined_mask = cv2.bitwise_or(green_mask, yellow_mask)
    contours, _ = cv2.findContours(combined_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    green_contours = []
    yellow_contours = []

    for cnt in contours:
        if not is_leaf_shape(cnt):
            continue

        x, y, w, h = cv2.boundingRect(cnt)

        roi_gray = gray[y:y + h, x:x + w]
        lap_var = cv2.Laplacian(roi_gray, cv2.CV_64F).var()
        if lap_var < 10:  # relaxed from 30
            print(f"Rejected contour (low texture: lap_var={lap_var:.2f})")
            continue

        roi_hsv = hsv[y:y + h, x:x + w]
        hue = roi_hsv[:, :, 0]
        if np.std(hue) < 5:  # relaxed from 10
            print(f"Rejected contour (low hue std: {np.std(hue):.2f})")
            continue

        mask_roi = np.zeros_like(green_mask)
        cv2.drawContours(mask_roi, [cnt], -1, 255, -1)

        green_count = cv2.countNonZero(cv2.bitwise_and(green_mask, green_mask, mask=mask_roi))
        yellow_count = cv2.countNonZero(cv2.bitwise_and(yellow_mask, yellow_mask, mask=mask_roi))

        print(f"Contour: green_count={green_count}, yellow_count={yellow_count}")

        if green_count > yellow_count:
            green_contours.append(cnt)
        else:
            yellow_contours.append(cnt)

    return green_contours, yellow_contours

def main():
    cap = cv2.VideoCapture('http://192.168.208.70:8080/video')

    if not cap.isOpened():
        print("❌ Could not open video stream. Check the URL or network.")
        return

    while True:
        ret, frame = cap.read()
        if not ret:
            print("❌ Failed to grab frame")
            break

        frame = cv2.resize(frame, (640, 480))
        green_mask, yellow_mask = get_leaf_masks(frame)
        green_contours, yellow_contours = filter_leaf_contours(green_mask, yellow_mask, frame)

        output = frame.copy()
        cv2.drawContours(output, green_contours, -1, (0, 255, 0), 3)
        cv2.drawContours(output, yellow_contours, -1, (0, 0, 255), 3)

        print(f"✅ Green contours: {len(green_contours)} | Red contours: {len(yellow_contours)}")

        cv2.imshow("Green Mask", green_mask)
        cv2.imshow("Yellow Mask", yellow_mask)
        cv2.imshow("📸 Leaf Health Detection", output)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
