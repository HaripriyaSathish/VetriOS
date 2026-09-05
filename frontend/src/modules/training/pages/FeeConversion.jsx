import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../../../api/client";
import "../styles/TrainingDashboard.css";

function FeeConversion() {
  const [enquiries, setEnquiries] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await client.get("/api/admissions/shortlisted/");
      setEnquiries(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't load shortlisted enquiries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) return <p className="td-empty">Loading…</p>;

  return (
    <div className="td-screen">
      <div className="td-head">
        <div>
          <h1>Fee & Conversion</h1>
          <p>{enquiries.length} shortlisted, awaiting fee plan or payment</p>
        </div>
      </div>

      {error && <p className="td-error">{error}</p>}

      <div className="td-panel">
        <div className="td-panel-head">
          <h3>Shortlisted Enquiries</h3>
        </div>
        <div className="td-table-scroll">
          <table className="td-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Course</th>
                <th>Email</th>
                <th>Fee Plan</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {enquiries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="td-empty">Nothing to convert right now.</td>
                </tr>
              ) : (
                enquiries.map((e) => (
                  <tr key={e.enquiry_id}>
                    <td className="td-name">{e.name}</td>
                    <td className="td-sub">{e.course_name}</td>
                    <td className="td-sub">{e.personal_email || "—"}</td>
                    <td>
                      <span className={"td-pill " + (e.has_fee_plan ? "on" : "off")}>
                        {e.has_fee_plan ? "Set" : "Not set"}
                      </span>
                    </td>
                    <td>
                      <Link to={`/training/fee-conversion/${e.enquiry_id}`}>
                        {e.has_fee_plan ? "Manage" : "Set Fee Plan"}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default FeeConversion;