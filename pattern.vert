// make this 120 for the mac:
#version 330 compatibility

// doesn't do anything lol
out vec2 vST;   
out vec3 vN;    
out vec3 vL;    
out vec3 vE;    

void main() {
    vST = gl_MultiTexCoord0.st;
    vN  = vec3(0.0);
    vL  = vec3(0.0);
    vE  = vec3(0.0);

    gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;
}
