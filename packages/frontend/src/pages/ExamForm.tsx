import React, { useState, useEffect } from "react";
import invokeApig from "../lib/callAPI.ts";
import { useParams, useNavigate } from "react-router-dom";
import { getCurrentUserEmail } from "../lib/getToken.ts";
import ExamCreationLoader from "../components/ExamCreationLoader.tsx";
import { useAlert } from "../components/AlertComponent.tsx";
import SpeechRecorder from "../components/SpeechRecorder.tsx";
import { getUserToken } from "../lib/getToken";

interface Part {
  part: string;
  title: string;
  total_marks: number;
  subsections: Subsection[];
}

interface Subsection {
  subsection: string;
  title: string;
  marks: number;
  content: {
    passage?: string;
    questions?: Question[];
  };
}

interface Question {
  question: string;
  description?: string;
  options?: string[];
}

interface ExamContent {
  parts: Part[];
  [key: string]: any;
}

const ExamForm: React.FC = () => {
  const [_grade, setGrade] = useState("");
  const [_subject, setSubject] = useState("");
  const [_duration, setDuration] = useState("");
  const [_totalMark, setMark] = useState("");
  const [_semester, setSemester] = useState("");
  const [createdBy, setCreator] = useState("");
  const [creationDate, setDate] = useState("");
  const [contributers, setContributers] = useState("");
  const [examState, setExamState] = useState("");
  const [_responseResult, _setResponseResult] = useState<string>("");
  const [examContent, setExamContent] = useState<ExamContent | null>(null);
  const [_editMode, _setEditMode] = useState(false);
  const [_editedContent, _setEditedContent] = useState<Record<string, any>>({});
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({});
  const [_loading, setLoading] = useState(false);
  const [loadingPage, setLoadingPage] = useState(true);
  const [_isLoading, _setIsLoading] = useState(false);
  const [loadingApproval, setLoadingApproval] = useState(false);
  const [feedback, setFeedback] = useState<{ [section: string]: string }>({});
  const [isEditing, setIsEditing] = useState(false);

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const [hasNavigated, setHasNavigated] = useState(false);

  // Polling for exam creation status
  const fetchInitialData = async () => {
    if (hasNavigated) {
      return;
    }
    try {
      //@ts-ignore
      const response = await invokeApig({
        path: `/examForm/${id}`,
        method: "GET",
      });

      if (!response || Object.keys(response).length === 0 || !response.examState) {
        showAlert({
          type: "progress",
          message: "🔄 جاري إنشاء الامتحان...",
        });
        setTimeout(fetchInitialData, 10000);
        return;
      }

      const state = response.examState;
      setExamState(state);

      if (state === "building" || state === "in_progress") {
        showAlert({
          type: "progress",
          message: "🔄 جاري إنشاء الامتحان...",
        });
        setTimeout(fetchInitialData, 10000);
        return;
      }

      // إذا وصلنا هنا، الامتحان جاهز
      // ✅ تحقق قبل محاولة القراءة
      const content = response.examContent;
      if (!content) {
        setTimeout(fetchInitialData, 10000);
        return;
      }

      let parsedContent;
      if (typeof content === "object") {
        parsedContent = content;
      } else if (typeof content === "string") {
        try {
          let cleaned = content.trim();
          if (cleaned.startsWith("```json")) {
            cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
          }
          const jsonStart = cleaned.indexOf("{");
          const jsonEnd = cleaned.lastIndexOf("}");
          if (jsonStart === -1 || jsonEnd === -1) {
            throw new Error("No valid JSON boundaries found");
          }
          const cleanJson = cleaned.substring(jsonStart, jsonEnd + 1);
          parsedContent = JSON.parse(cleanJson);
        } catch (parseErr) {
          showAlert({
            type: "failure",
            message: "Invalid exam format",
          });
          return;
        }
      } else {
        showAlert({
          type: "failure",
          message: "Invalid exam format",
        });
        return;
      }

      setExamContent(parsedContent);
      setGrade(response.examClass || "");
      setSubject(response.examSubject || "");
      setSemester(response.examSemester || "");
      setCreator(response.createdBy || "");
      setDate(response.creationDate || "");
      setContributers(String(response.contributors || ""));
      setDuration(response.examDuration || "");
      setMark(response.examMark || "");

      // التنقل التلقائي عند اكتمال البناء
      if ((state !== "building" && state !== "in_progress") && !hasNavigated) {
        setHasNavigated(true);
        navigate(`/dashboard/viewExam/${id}`);
      }
    } catch (err) {
      showAlert({
        type: "failure",
        message: "Failed to load",
      });
    } finally {
      setLoadingPage(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;
    const timer = setTimeout(async () => {
      try {
        if (!isCancelled) {
          await fetchInitialData();
        }
      } catch (error) {
        if (!isCancelled) {
          showAlert({
            type: "failure",
            message: "Failed to load",
          });
        }
      }
    }, 2000);
    return () => {
      clearTimeout(timer);
      isCancelled = true;
    };
    // eslint-disable-next-line
  }, [id]);

  // ... باقي الدوال مثل fetchExamContent و sendForApproval و handleFeedbackSubmission ...

  // ... باقي كود الصفحة كما هو (UI) ...
  // يمكنك نسخ الجزء الخاص بالـ return من كودك الحالي بدون تغيير

  // --- UI code remains unchanged ---
  // ...existing code...
};

export default ExamForm;
