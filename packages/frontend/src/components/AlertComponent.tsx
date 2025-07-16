import { createContext, useContext, useState, ReactNode } from "react";
import "../styles/AlertPopup.css";

// Define the AlertConfig interface with action as a function that returns void or null
interface AlertConfig {
    isOpen: boolean;
    type: string;
    message: string;
    action?: () => void; // The action function should return void
}

// AlertContextType for managing the alert state and functions
interface AlertContextType {
    alertConfig: AlertConfig;
    showAlert: (config: Omit<AlertConfig, "isOpen">) => void;
    closeAlert: () => void;
}

// Create context to manage alert state globally
const AlertContext = createContext<AlertContextType | undefined>(undefined);

// AlertProvider Component (Context for Managing Alerts)
export const AlertProvider = ({ children }: { children: ReactNode }) => {
    const [alertConfig, setAlertConfig] = useState<AlertConfig>({
        isOpen: false,
        type: "",
        message: "",
        action: undefined,
    });

    // Function to show alert
    const showAlert = ({
        type,
        message,
        action = undefined,
    }: Omit<AlertConfig, "isOpen">) => {
        setAlertConfig({ isOpen: true, type, message, action });
    };

    // Function to close the alert
    const closeAlert = () => {
        setAlertConfig({ ...alertConfig, isOpen: false });
    };

    return (
        <AlertContext.Provider value={{ alertConfig, showAlert, closeAlert }}>
            {children}
        </AlertContext.Provider>
    );
};

// Custom hook to use the alert context
export const useAlert = (): AlertContextType => {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error("useAlert must be used within an AlertProvider");
    }
    return context;
};

// ConfirmAction Component
export const ConfirmAction = () => {
    const { alertConfig, closeAlert } = useAlert();

    // Render confirm dialog only if the alert type is "confirm"
    if (!alertConfig.isOpen || alertConfig.type !== "confirm") return null;

    // Handle confirm action
    const handleConfirm = () => {
        console.log("Confirm clicked"); // Debugging: log when button is clicked
        if (alertConfig.action) {
            alertConfig.action(); // Execute the provided action (void)
        }
        closeAlert(); // Close the alert popup
    };

    return (
        <div className="alert-overlay">
            <div className="alert-popup alert-confirm">
                <p>{alertConfig.message}</p>
                <div className="alert-buttons">
                    <button className="alert-confirm-btn" onClick={handleConfirm}>Continue</button> <br />
                    <button className="alert-failure-btn" onClick={closeAlert}>Cancel</button>
                </div>
            </div>
        </div>
    );
};

// Notification Component
export const Notification = () => {
  const { alertConfig, closeAlert } = useAlert();

  // Render notification only if alert type is not "confirm"
  if (!alertConfig.isOpen || alertConfig.type === "confirm") return null;

  // Dynamically set the style class based on type
  const notificationClass =
      alertConfig.type === "success"
        ? "alert-success"
        : alertConfig.type === "progress"
        ? "alert-progress"
        : "alert-failure";

    
    const icon =
      alertConfig.type === "success"
        ? "✅"
        : alertConfig.type === "progress"
        ? "⏳"
        : "❌";


  return (
    <div className="alert-overlay">
      <div className={`alert-popup ${notificationClass}`}>
        <p>
          {icon} {" "}
          {alertConfig.message}
        </p>
        <button className="close-btn" onClick={closeAlert}>Close</button>
      </div>
    </div>
  );
};
