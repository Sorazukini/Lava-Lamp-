# Lava-Lamp-
![Lava Lamp Screenshot](Screenshot%202026-03-14%20210117.png)

A real-time animated lava lamp simulation built with GLSL and OpenGL, rendered entirely through a raymarching algorithm. The simulation uses signed distance field (SDF) functions to define four animated metaballs that smoothly blend together using a polynomial smooth-minimum combiner, creating organic, fluid motion driven by time-based animation.
Surface normals are computed via central-difference gradient sampling of the SDF, feeding into a full Phong lighting model with adjustable ambient, diffuse, and specular components. A hollow glass cylinder is constructed using CSG boolean operations on cylindrical SDFs, with Fresnel-based rim glow and specular highlights to simulate transparency.
Built with: C++, GLSL, OpenGL, GLUT
