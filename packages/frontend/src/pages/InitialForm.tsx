import React, { useState } from "react";
import { getCurrentUserEmail } from "../lib/getToken.js";
import { getFormattedDateTime } from "../lib/getDateTime.js";
import { useNavigate } from "react-router-dom";
import invokeLambda from "../lib/invokeLambda.ts";
import { useAlert } from "../components/AlertComponent.tsx";
import ExamCreationLoader from "../components/ExamCreationLoader.tsx";

export function InitialForm() {
  const [grade, setGrade] = useState("Grade 10");
  const [subject, setSubject] = useState("ENG102");
  const [semester, setSemester] = useState("Second 2024/2025");
  const duration = "2";
  const totalMark = "50";
  const questionCounts = {
    MCQ: 0,
    Essay: 0,
    TrueFalse: 0,
    FillInTheBlank: 0,
    ShortAnswer: 0,
  };
  const [loading, setLoading] = useState(false);
  const newExam = true;
  const navigate = useNavigate();
  const { showAlert } = useAlert();


  const handleInitialFormSubmition = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const currentUserEmail = await getCurrentUserEmail();
      console.log("Current User Email:", currentUserEmail);

      const createDate = getFormattedDateTime();

      if (!grade || !subject || !semester) {
        console.log(grade, subject, semester, duration, totalMark);
        showAlert({
          type: "failure",
          message: "Please fill out all fields",
        });
        setLoading(false);
        return;
      }
      
      const payload = {
        class: grade,
        subject: subject,
        semester: semester,
        duration: duration,
        total_mark: totalMark,
        question_types: questionCounts,
        customize: false,
        created_by: currentUserEmail,
        creation_date: createDate,
        contributors: currentUserEmail,
      };

      console.log(payload);

      //const functionURL = import.meta.env.VITE_CREATE_EXAM_FUNCTION_URL;
      //console.log("Function URL:", functionURL);

      //@ts-ignore
     // const response = await invokeLambda({
       // method: "POST",
       // body: payload,
       // url: functionURL,
      //});
      const apiURL = `${import.meta.env.VITE_API_URL}/queueExam`;

      const response = await invokeLambda({
        method: "POST",
        body: payload,
        url: apiURL,
      });



      if (!response.ok) {
        showAlert({
          type: "info", // was failure
          message: "⏳ الامتحان قيد الإنشاء... سيتم عرضه في قائمة الامتحانات خلال لحظات.", //was Failed to generate exam
        })
        setLoading(false);
        return;
      }

      console.log("API Response:", response);
      console.log("Type of response content:", typeof response);

      //console.log(response.body);
      //const data = await response.json();
     // console.log(data);

      const data = await response.json();

      if (!data) {
        console.warn("Failed to parse JSON response or empty body");
        showAlert({
          type: "info",
          message: "⏳ الامتحان قيد الإنشاء... سيتم عرضه بعد قليل في قائمة الامتحانات.",
        });
        setLoading(false);
        return;
      }
      
      console.log(data);

      const examID = data.examID;
      navigate("/dashboard/examForm/" + examID);
    } catch (error) {
      console.error("Error submitting form:", error);
      showAlert({
        type: "info", //was failure
        message: "⏳ الامتحان قيد الإنشاء... سيتم عرضه بعد قليل في قائمة الامتحانات.", // was Failed to generate exam
      });
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: "#ffffff",
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflowY: "auto", // Enables vertical scrolling if needed
        height: "auto", // Ensures the form fits the viewport
      }}
    >
      <div>
        {loading && (
          <div
            style={{
              width: "100%",
              maxWidth: "700px",
              padding: "2rem",
              borderRadius: "12px",
            }}
          >
            <h3
              style={{
                textAlign: "center",
                color: "rgb(12, 84, 125)",
                fontWeight: "700",
                fontSize: "24px",
                fontFamily: "Arial, sans-serif",
              }}
            >
              Generating
            </h3>
            <ExamCreationLoader /> <br />
          </div>
        )}
      </div>

      {newExam && !loading && (
        <form
          onSubmit={handleInitialFormSubmition}
          style={{
            width: "100%",
            maxWidth: "700px",
            backgroundColor: "#fff",
            padding: "2rem",
            borderRadius: "12px",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
            fontFamily: "Arial, sans-serif",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem", // Consistent spacing between elements
          }}
        >
          <h2
            style={{
              fontFamily: "Arial, sans-serif",
              color: "rgb(12, 84, 125)",
              marginBottom: "2rem",
              marginTop: "0rem",
              fontSize: "24px",
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            Generate Exam
          </h2>
          <div
            style={{
              width: "100%",
              display: "flex",
              flexWrap: "wrap", // Responsive behavior
              gap: "1.5rem",
            }}
          >
            <label
              style={{
                flex: "1",
                minWidth: "30%",
                fontSize: "16px",
                color: "rgb(12, 84, 125)",
                fontWeight: "bold",
              }}
            >
              Grade
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: "0.5rem",
                  padding: "0.5rem",
                  borderRadius: "12px",
                  border: "1px solid #ccc",
                  fontSize: "14px",
                }}
              >
                <option value="Grade 10">Grade 10</option>
              </select>
            </label>
            <label
              style={{
                flex: "1",
                minWidth: "30%",
                fontSize: "16px",
                color: "rgb(12, 84, 125)",
                fontWeight: "bold",
              }}
            >
              Semester
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: "0.5rem",
                  padding: "0.5rem",
                  borderRadius: "12px",
                  border: "1px solid #ccc",
                  fontSize: "14px",
                }}
              >
                <option value="Second 2024/2025">Second 2024/2025</option>
                <option value="First 2024/2025">First 2024/2025</option>
              </select>
            </label>

            <label
              style={{
                flex: "1",
                minWidth: "30%",
                fontSize: "16px",
                color: "rgb(12, 84, 125)",
                fontWeight: "bold",
              }}
            >
              Subject
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: "0.5rem",
                  padding: "0.5rem",
                  borderRadius: "12px",
                  border: "1px solid #ccc",
                  fontSize: "14px",
                }}
              >
                <option value="ENG102">ENG102</option>
                <option value="ARAB101">ARAB101</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              alignSelf: "flex-end",
              backgroundColor: "rgb(12, 84, 125)",
              color: "#fff",
              padding: "5px 35px",
              borderRadius: "20px",
              border: "none",
              fontSize: "16px",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: "600",
              transition: "background-color 0.3s ease",
            }}
            //@ts-ignore
            onMouseEnter={(e) =>
              //@ts-ignore
              (e.target.style.backgroundColor = "rgba(3, 40, 61, 1)")
            }
            //@ts-ignore
            onMouseLeave={(e) =>
              //@ts-ignore
              (e.target.style.backgroundColor = "rgb(12, 84, 125)")
            }
          >
            Generate
          </button>
        </form>
      )}

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

export default InitialForm;
