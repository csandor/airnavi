create an android app that helps to visually navigate a pilot through straight flight lines.
- input is a 3D kml file with flight lines with start and end points and elevation of the lines, and their sequence number
based on the gps position acquired from the system the app should indicate the position of the aircraft relative to the flight lines
the app displays the following:
- flight line selector control
- flight line direction switcher (start->end or end->start)
- displays the position of the flight line relative to the aircraft from the POV of the aircraft
- number of currently targeted flight line
- distance to the start of the flight line
- ground speed from GPS
- attitude of the aircraft relative to the flight line as number in degrees and graphically
- altitude difference of the aircraft relative to the flight line
- displays 4 arrows in the center of the screen indicating the direction where the pilot needs to fly to reach the start of the flight line
- lef-right arrows indicate the direction of the flight line relative to the aircraft
- up-down arrows indicate the altitude difference of the aircraft relative to the flight line
- when the aircraft is aligned with direction, altitude of the line and the distance is decreasing to the start point of the flight line, the arrows are not displayed
- the app should also help the pilot to navigate the aircraft to the flight line with a color coded halo around the center. green when properly on the line, yellow when close to the line, red when far from the line (distances and angles should be configurable)
- indicate visually when the aircraft has started to fly along the current flight line (with a configurable threshold)
- indicate visually when the aircraft has reached the end of the current flight line
- if a configurable portion (95% for example) the app should register completion of the flight line into a text file and move to the next one with a higher number which have not been flown yet
- log start and end time, maximum distance to the line, maximum altitude difference, maximum attitude difference, maximum speed, maximum heading difference
- remove the completed flight line from the selector control
