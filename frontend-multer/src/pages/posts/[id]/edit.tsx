import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../../contexts/AuthContext";
import ProtectedRoute from "../../../components/ProtectedRoute";

interface Author {
  username: string;
}

interface Post {
  id: string;
  content: string;
  imagePath?: string;
  createdAt: string;
  updatedAt: string;
  author?: Author;
}

function EditPostContent() {
  const [post, setPost] = useState<Post | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { id: postId } = router.query;
  const { token, user } = useAuth();

  useEffect(() => {
    if (!postId) return;

    async function fetchPost() {
      try {
        const response = await fetch(`http://localhost:3000/posts/${postId}`);
        if (response.ok) {
          const postData = await response.json();
          // Check if user can edit this post
          if (
            postData.author &&
            user &&
            postData.author.username !== user.username
          ) {
            alert("You can only edit your own posts");
            router.push("/");
            return;
          }
          setPost(postData);
          setContent(postData.content);
        } else {
          router.push("/");
        }
      } catch (error) {
        router.push("/");
      } finally {
        setLoading(false);
      }
    }

    fetchPost();
  }, [postId, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!content.trim()) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(`http://localhost:3000/posts/${postId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: content.trim() }),
      });

      if (response.ok) {
        router.push(`/posts/${postId}`);
      } else if (response.status === 401) {
        alert("Please login to edit posts");
        router.push("/auth/login");
      } else if (response.status === 403) {
        alert("You can only edit your own posts");
        router.push("/");
      } else {
        alert("Error updating post");
      }
    } catch (error) {
      alert("Error updating post");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!post) {
    return <div>Post not found</div>;
  }

  return (
    <>
      <h1>Edit Post</h1>

      {post.imagePath && (
        <div className="mb-3">
          <img
            src={`${process.env.NEXT_PUBLIC_UPLOAD_URL}/${post.imagePath}`}
            alt="Post image"
            className="img-fluid rounded"
            style={{
              maxWidth: "100%",
              maxHeight: "300px",
              objectFit: "contain",
            }}
          />
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="content" className="form-label">
            Content
          </label>
          <textarea
            className="form-control"
            id="content"
            rows={5}
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <div className="mb-3">
          <small className="text-muted">
            <strong>Created:</strong> {post.createdAt}
            <br />
            <strong>Last Updated:</strong> {post.updatedAt}
          </small>
        </div>

        <div className="d-flex gap-2">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Updating..." : "Update Post"}
          </button>
          <a href={`/posts/${postId}`} className="btn btn-secondary">
            Cancel
          </a>
        </div>
      </form>
    </>
  );
}

export default function EditPost() {
  return (
    <ProtectedRoute>
      <EditPostContent />
    </ProtectedRoute>
  );
}
