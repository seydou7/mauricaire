import { useState, useEffect } from "react";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem("mock_auth") === "true";
  });
  
  const [user, setUser] = useState(() => {
    const role = localStorage.getItem("mock_role") || "patient";
    return isAuthenticated ? { 
      _id: "mock_id", 
      name: role === "patient" ? "Patient Test" : "Aide-soignant Test", 
      email: "test@test.com", 
      role 
    } : null;
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const isAuth = localStorage.getItem("mock_auth") === "true";
      setIsAuthenticated(isAuth);
      const role = localStorage.getItem("mock_role") || "patient";
      if (isAuth) {
        setUser({ 
          _id: "mock_id", 
          name: role === "patient" ? "Patient Test" : "Aide-soignant Test", 
          email: "test@test.com", 
          role 
        });
      } else {
        setUser(null);
      }
    };
    
    window.addEventListener("mock_auth_change", handleStorageChange);
    return () => window.removeEventListener("mock_auth_change", handleStorageChange);
  }, []);

  const signIn = async (method: string, formData?: FormData) => {
    let role = "patient";
    if (formData && formData.get("role")) {
       role = formData.get("role") as string;
    }
    
    // Simulating delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    localStorage.setItem("mock_auth", "true");
    localStorage.setItem("mock_role", role);
    window.dispatchEvent(new Event("mock_auth_change"));
  };

  const signOut = async () => {
    localStorage.removeItem("mock_auth");
    localStorage.removeItem("mock_role");
    window.dispatchEvent(new Event("mock_auth_change"));
  };

  return {
    isLoading: false,
    isAuthenticated,
    user,
    signIn,
    signOut,
  };
}
