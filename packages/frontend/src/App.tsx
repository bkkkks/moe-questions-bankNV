import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom"; // Navigation between pages.
import Dashboard from "./pages/Dashboard";
import Login from "./pages/LoginPage";
import ExamForm from "./pages/ExamForm";
import { AppContext, AppContextType } from "./lib/contextLib";
import "@aws-amplify/ui-react/styles.css";
import AuthRoute from "./components/AuthRoute";
import { InitialForm } from "./pages/InitialForm";
import { getCurrentUser } from "./lib/getToken";
import AlreadyAuthRoute from "./components/AlreadyAuthRoute";
import GeneratorRoute from "./components/generatorRoutes";
import ApproverRoute from "./components/ApproverRoute";
import ExamApproval from "./pages/ExamApproval";
import NotFound from "./pages/NotFound";
import ViewExam from "./pages/ViewExam";
import {
  AlertProvider,
  Notification,
  ConfirmAction,
} from "./components/AlertComponent"; // Import Alert components
import UploadPage from "./pages/UploadPage";
import DefaultRouting from "./components/UserDefaultComponent";
import AudioScriptForm from "./pages/AudioPage";
import { getCookie, setCookie } from "./lib/cookies";

const App: React.FC = () => {
  // Authentication state
  const [isAuthenticated, setAuthenticated] = useState<boolean>(
    getCookie("isAuthenticated") === "true"
  );
  const [userRole, setUserRole] = useState<string>(getCookie("userRole") || "");

  // Restore authentication state on app load
  useEffect(() => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      const storedIsAuthenticated = getCookie("isAuthenticated");
      const storedUserRole = getCookie("userRole");

      setAuthenticated(storedIsAuthenticated === "true");
      setUserRole(storedUserRole || "");
    }
  }, []);

  // Persist authentication state when it changes
  useEffect(() => {
    setCookie("isAuthenticated", String(isAuthenticated), 1);
    setCookie("userRole", userRole, 1);
  }, [isAuthenticated, userRole]);

  const appContextValue: AppContextType = {
    isAuthenticated,
    userHasAuthenticated: setAuthenticated,
    userRole,
    updateUserRole: setUserRole,
  };

  return (
    <AppContext.Provider value={appContextValue}>
      <AlertProvider>
        {" "}
        {/* Wrap everything with AlertProvider */}
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route
              path="/login"
              element={
                <AlreadyAuthRoute>
                  <Login />
                </AlreadyAuthRoute>
              }
            />

            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <AuthRoute>
                  <Dashboard />
                </AuthRoute>
              }
            >
              {/* Nested Routes for Dashboard */}
              <Route index element={<div></div>} /> {/* Default Content */}
              <Route
                path="examForm"
                element={
                  <GeneratorRoute>
                    <InitialForm />
                  </GeneratorRoute>
                }
              />
              <Route
                path="upload"
                element={
                  <GeneratorRoute>
                    <UploadPage />
                  </GeneratorRoute>
                }
              />
              <Route path="examForm/:id" element={<ExamForm />} />
              <Route path="viewExam/:id" element={<ViewExam />} />
              <Route
                path="audioPage"
                element={
                  <GeneratorRoute>
                    <AudioScriptForm />
                  </GeneratorRoute>
                }
              />
              <Route
                path="approveExam"
                element={
                  <ApproverRoute>
                    <ExamApproval />
                  </ApproverRoute>
                }
              />
            </Route>

            {/* Redirect '/' to '/dashboard' */}
            <Route path="/" element={<DefaultRouting />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
        {/* Include the alert components to display alerts */}
        <Notification /> {/* Displays success/failure alerts */}
        <ConfirmAction /> {/* Displays confirmation dialogs */}
      </AlertProvider>
    </AppContext.Provider>
  );
};

export default App;
