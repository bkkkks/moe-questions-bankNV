import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { Exam, Section, SubSection, Content, Question, Exercise, ReadingQuestions } from "./InterfacesPDF";

export const generateExamPDF = (jsonString: string) => {
    const jsonContent = jsonString.substring(
        jsonString.indexOf("{"),
        jsonString.lastIndexOf("}") + 1
    );
    const parsedExam = JSON.parse(jsonContent);
    console.log(parsedExam);
    const exam: Exam = parsedExam;

    const doc = new jsPDF();
    let yPosition = 30;

    addExamInfo(doc, exam, yPosition);
    yPosition += 30;

    exam.sections.forEach((section) => {
        yPosition = addSection(doc, section, yPosition);
    });

    addFooter(doc, exam.title);

    doc.save(`${exam.title.replace(/\s+/g, '_')}.pdf`);
};

function addFooter(doc: jsPDF, title: string): void {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont("Times", "italic", 10);
        doc.text(`${title}`, 10, 290);
        doc.text(`Page ${i} of ${pageCount}`, 200, 290, { align: "right" });
    }
}

function addExamInfo(doc: jsPDF, exam: Exam, yPosition: number): void {
    doc.setFont("Times", "bold", 18);
    doc.text(exam.title, 105, yPosition, { align: "center" });

    yPosition += 10;
    doc.setFont("Times", "normal", 12);
    doc.text(`Total Marks: ${exam.total_marks}`, 20, yPosition);
    doc.text(`Time: ${exam.time}`, 160, yPosition);
}

function addSection(doc: jsPDF, section: Section, yPosition: number): number {
    if (yPosition > 200) {
        doc.addPage();
        yPosition = 30;
    }

    doc.setFont("Times", "bold", 14);
    doc.text(`Part ${section.part}: ${section.title} (${section.total_marks} marks)`, 20, yPosition);
    yPosition += 12;

    if (section.subsections && section.subsections.length > 0) {
        section.subsections.forEach((subsection) => {
            yPosition = addSubSection(doc, subsection, yPosition);
        });
    }

    if (section.content) {
        yPosition = addContent(doc, section, yPosition);
    }

    yPosition += 20; // Add extra spacing between sections

    return yPosition;
}

function addSubSection(doc: jsPDF, subsection: SubSection, yPosition: number): number {
    if (yPosition > 200) {
        doc.addPage();
        yPosition = 30;
    }

    doc.setFont("Times", "italic", 12);
    doc.text(`Subsection ${subsection.subsection}: ${subsection.title} (${subsection.marks} marks)`, 20, yPosition);
    yPosition += 10;

    if (subsection.content) {
        yPosition = addContent(doc, subsection, yPosition);
    }

    yPosition += 10; // Add extra spacing between subsections

    return yPosition;
}

function addContent(doc: jsPDF, section: SubSection | Section, yPosition: number): number {

    // it may be a SubSection or a Section
    const content = section.content as Content;

    if (content.passage && !section.title.includes("Listening")) {
        yPosition = addTextBlock(doc, content.passage, yPosition + 10, "Passage:\n\n") + 20;
    }

    // if (content.dialogue) {
    //     yPosition = addTextBlock(doc, content.dialogue, yPosition, "Dialogue:") + 10;
    // }

    if (Array.isArray(content.questions) && !content.questions.every((q: any) => q.word_limit)) {
        yPosition = addGeneralQuestions(doc, content.questions, yPosition);
    } else if (content.questions) {
        const questions = content.questions as ReadingQuestions;

        if (questions["multiple-choice"]) {
            yPosition = addGeneralQuestions(doc, questions["multiple-choice"], yPosition + 20, "Multiple Choice:") + 20;
        }
        if (questions["true-false"]) {
            yPosition = addTrueFalseQuestions(doc, questions["true-false"], yPosition) + 10;
        }
        if (questions["vocabulary-matching"]) {
            yPosition = addVocabularyMatching(doc, questions["vocabulary-matching"], yPosition) + 20;
        }
    }

    if (content.exercises) {
        yPosition = addExercises(doc, content.exercises, yPosition);
    }

    if (Array.isArray(content.questions) && content.questions.every(q => q.word_limit)) {
        yPosition = addWritingQuestions(doc, content.questions, yPosition);
    }

    return yPosition;
}

function addTextBlock(doc: jsPDF, text: string, yPosition: number, heading: string): number {
    doc.setFont("Times", "bold", 12);
    doc.text(heading, 20, yPosition);
    yPosition += 6;

    doc.setFont("Times", "normal", 11);
    const lines = doc.splitTextToSize(text, 170);
    doc.text(lines, 20, yPosition);
    return yPosition + lines.length * 6 + 30;
}

function addGeneralQuestions(doc: jsPDF, questions: Question[], yPosition: number, heading?: string): number {

    if (heading) {
        if (yPosition > 200) {
            doc.addPage();
            yPosition = 30;
            doc.setFont("Times", "bold", 12);
            doc.text(heading, 20, yPosition);
            yPosition += 10;
        }
    }

    questions.forEach((q, index) => {
        if (yPosition > 200) {
            doc.addPage();
            yPosition = 30;
        }

        doc.setFont("Times", "normal", 11);
        doc.text(`${index + 1}. ${q.question || q.sentence}`, 20, yPosition);
        yPosition += 13;

        q.options?.forEach((option, i) => {
            doc.text(`   ${String.fromCharCode(65 + i)}. ${option}`, 20, yPosition);
            yPosition += 8;
        });
    });

    return yPosition;
}

function addTrueFalseQuestions(doc: jsPDF, questions: Question[], yPosition: number): number {
    doc.setFont("Times", "bold", 12);
    doc.text("True/False Questions:", 20, yPosition);
    yPosition += 13;

    questions.forEach((q, index) => {
        if (yPosition > 200) {
            doc.addPage();
            yPosition = 30;
        }

        doc.setFont("Times", "normal", 11);
        doc.text(`${index + 1}. ${q.statement} (   )`, 20, yPosition);
        yPosition += 13;
    });

    return yPosition;
}

function shuffleArray(A: Question[]): void {
    for (let i = A.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1)); // Random index from 0 to i
        [A[i], A[j]] = [A[j], A[i]]; // Swap elements
    }
}


function addVocabularyMatching(doc: jsPDF, vocabList: Question[], yPosition: number): number {
    doc.setFont("Times", "bold", 12);
    doc.text("Vocabulary Matching:", 20, yPosition);
    yPosition += 10;

    let list_of_vocab = '';
    shuffleArray(vocabList); 
    vocabList.forEach((vocab, index) => {
       list_of_vocab += `${index + 1}. ${(vocab as any).word}     `;
    });

    doc.setFont("Times", "bold", 11);
    doc.text(list_of_vocab, 20, yPosition);

    vocabList.forEach((vocab, index) => {
        if (yPosition > 210) {
            doc.addPage();
            yPosition = 30;
        }
        doc.setFont("Times", "normal", 11);
        doc.text(`${index + 1}. __________________ ${(vocab as any).definition}`, 20, yPosition + 20);
        yPosition += 10;
    });

    return yPosition;
}

function addExercises(doc: jsPDF, exercises: Exercise[], yPosition: number): number {
    doc.setFont("Times", "bold", 12);
    doc.text("Exercises:", 20, yPosition);
    yPosition += 15;

    exercises.forEach((exercise, index) => {
        if (yPosition > 200) {
            doc.addPage();
            yPosition = 30;
        }

        doc.setFont("Times", "normal", 11);
        doc.text(`${index + 1}. ${exercise.question}`, 20, yPosition);
        yPosition += 12;
    });

    return yPosition;
}

function addWritingQuestions(doc: jsPDF, writingQuestions: Question[], yPosition: number): number {
    writingQuestions.forEach((q, index) => {
        doc.setFont("Times", "bold", 12);
        doc.text(`Writing Question ${index + 1}:`, 20, yPosition);
        yPosition += 10;

        doc.setFont("Times", "normal", 11);
        doc.text(q.prompt as string, 20, yPosition);
        yPosition += 10;

        doc.text(`Word Limit: ${q.word_limit}`, 20, yPosition);
        yPosition += 10;
    });

    return yPosition;
}



